// Pipeline-mode VoiceProvider (02-SPEC-TECHNICZNA.md §5.1-§5.3): browser Web Speech
// API for mic input (SpeechRecognition/webkitSpeechRecognition) and spoken readout
// (speechSynthesis). Zero cost, fully offline-capable, no server involvement.
import { chunkForSpeech, stripForSpeech } from './textChunking';
import type { VoiceErrorCode, VoiceEvent, VoiceEventType, VoiceLang, VoiceProvider } from './types';

const SILENCE_TIMEOUT_MS = 8_000;
const VOICES_READY_TIMEOUT_MS = 1_000;

// Minimal shape for the non-standard (still-experimental) SpeechRecognition API —
// defined locally rather than relying on ambient DOM lib types, which may or may
// not include it depending on the TypeScript version, and never include the
// webkit-prefixed variant at all.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function mapRecognitionError(code: string): VoiceErrorCode {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
    case 'no-speech':
    case 'audio-capture':
    case 'network':
    case 'language-not-supported':
    case 'aborted':
      return code;
    default:
      return 'unknown';
  }
}

function getVoicesWhenReady(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    let settled = false;
    const finish = (voices: SpeechSynthesisVoice[]): void => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(voices);
    };
    const handler = (): void => finish(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => finish(window.speechSynthesis.getVoices()), VOICES_READY_TIMEOUT_MS);
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: VoiceLang): SpeechSynthesisVoice | undefined {
  const exact = voices.find((v) => v.lang === lang);
  if (exact) return exact;
  const prefix = lang.split('-')[0];
  const localPrefixMatch = voices.find((v) => v.lang.startsWith(prefix ?? lang) && v.localService);
  return localPrefixMatch ?? voices.find((v) => v.lang.startsWith(prefix ?? lang));
}

export class WebSpeechProvider implements VoiceProvider {
  readonly id = 'web-speech';
  readonly mode = 'pipeline';

  private recognition: SpeechRecognitionLike | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<VoiceEventType, Set<(e: VoiceEvent) => void>>();
  private currentLang: VoiceLang = 'en-US';

  // Separate from SpeechRecognition on purpose: recognition gives transcripts, not
  // audio levels. This is a second, parallel getUserMedia stream used only to
  // drive the mic-reactive VoiceOrb visual — purely cosmetic, never required for
  // recognition itself to work, so any failure here is swallowed silently.
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micData: Uint8Array<ArrayBuffer> | null = null;
  private micStream: MediaStream | null = null;

  // Bumped on every cancelSpeech() so an in-flight speakNext() chain (reached via
  // the cancelled utterance's own onerror callback) knows to stop instead of
  // treating the cancellation as "this chunk ended, speak the next one".
  private speechGeneration = 0;

  isSupported(): boolean {
    return typeof window !== 'undefined' && getRecognitionConstructor() !== undefined;
  }

  /** Synthesis is a separate capability from recognition (e.g. Firefox has this but not the mic). */
  static isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Phones and tablets let only one capture hold the microphone: opening getUserMedia next to
   * SpeechRecognition makes recognition fail or end at once (seen on Android Chrome). So the
   * cosmetic level meter is skipped there and the orb uses a gentle simulated pulse instead.
   */
  private static micMayBeShared(): boolean {
    if (typeof navigator === 'undefined') return false;
    const touchOnly = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    return !touchOnly && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /** Current mic volume (0-1), for VoiceOrb. Simulated while listening without a real meter; 0 otherwise. */
  getAudioLevel(): number {
    if (!this.analyser || !this.micData) {
      if (!this.recognition) return 0;
      const t = performance.now() / 1000;
      return 0.22 + 0.12 * Math.sin(t * 5.1) + 0.06 * Math.sin(t * 8.3);
    }
    this.analyser.getByteTimeDomainData(this.micData);
    let sum = 0;
    for (const value of this.micData) {
      const d = (value - 128) / 128;
      sum += d * d;
    }
    return Math.min(1, Math.sqrt(sum / this.micData.length) * 5);
  }

  private async startMicLevelMeter(): Promise<void> {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const AudioCtx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = this.audioCtx ?? new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      // `new Uint8Array(number)` infers Uint8Array<ArrayBufferLike>, which
      // getByteTimeDomainData's stricter Uint8Array<ArrayBuffer> param rejects —
      // allocating the buffer explicitly keeps the more precise type.
      this.micData = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      source.connect(analyser);
      this.analyser = analyser;
    } catch {
      // No level meter — the orb just won't pulse with volume. Recognition itself
      // uses the browser's own mic access and is unaffected by this failing.
    }
  }

  private stopMicLevelMeter(): void {
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    this.analyser = null;
    this.micData = null;
  }

  on(event: VoiceEventType, cb: (e: VoiceEvent) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  private emit(event: VoiceEvent): void {
    this.listeners.get(event.type)?.forEach((cb) => cb(event));
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => this.stop(), SILENCE_TIMEOUT_MS);
  }

  setLang(lang: VoiceLang): void {
    this.currentLang = lang;
  }

  async start(opts: { lang: VoiceLang }): Promise<void> {
    // Clicking the mic interrupts any ongoing readout (§5.1 step 1).
    this.cancelSpeech();

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      this.emit({ type: 'error', code: 'unknown', message: 'Speech recognition is not supported.' });
      return;
    }

    this.currentLang = opts.lang;
    if (WebSpeechProvider.micMayBeShared()) void this.startMicLevelMeter();
    const recognition = new Recognition();
    recognition.lang = opts.lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    this.recognition = recognition;

    recognition.onstart = () => {
      this.emit({ type: 'state', state: 'listening' });
      this.resetSilenceTimer();
    };

    recognition.onresult = (event) => {
      this.resetSilenceTimer();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          this.emit({ type: 'transcript', text: transcript.trim() });
        } else {
          this.emit({ type: 'interim', text: transcript });
        }
      }
    };

    recognition.onerror = (event) => {
      this.clearSilenceTimer();
      const code = mapRecognitionError(event.error);
      if (code !== 'aborted') {
        this.emit({ type: 'error', code, message: `Speech recognition error: ${event.error}` });
      }
    };

    recognition.onend = () => {
      this.clearSilenceTimer();
      this.stopMicLevelMeter();
      this.recognition = null;
      this.emit({ type: 'state', state: 'idle' });
    };

    recognition.start();
  }

  stop(): void {
    this.clearSilenceTimer();
    this.recognition?.stop();
  }

  async speak(text: string): Promise<void> {
    if (!WebSpeechProvider.isSynthesisSupported()) return;
    this.cancelSpeech();

    const cleaned = stripForSpeech(text);
    if (!cleaned) return;
    const chunks = chunkForSpeech(cleaned);
    if (chunks.length === 0) return;

    const voices = await getVoicesWhenReady();
    const voice = pickVoice(voices, this.currentLang);
    const generation = ++this.speechGeneration;

    return new Promise((resolve) => {
      this.emit({ type: 'state', state: 'speaking' });
      let index = 0;
      const speakNext = (): void => {
        // A cancellation bumped the generation since this chain started — whether
        // it ended normally or was interrupted, stop here rather than continuing
        // (speechSynthesis.cancel() fires the live utterance's onerror, which
        // would otherwise read as "chunk done, speak the next one").
        if (generation !== this.speechGeneration) {
          resolve();
          return;
        }
        if (index >= chunks.length) {
          this.emit({ type: 'state', state: 'idle' });
          resolve();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = this.currentLang;
        if (voice) utterance.voice = voice;
        index += 1;
        utterance.onend = speakNext;
        utterance.onerror = speakNext;
        window.speechSynthesis.speak(utterance);
      };
      speakNext();
    });
  }

  cancelSpeech(): void {
    this.speechGeneration++;
    if (WebSpeechProvider.isSynthesisSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      this.emit({ type: 'state', state: 'idle' });
    }
  }
}
