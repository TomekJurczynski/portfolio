// Pipeline-mode VoiceProvider with cloud read-aloud: mic input stays on the browser's Web Speech
// API (delegated to WebSpeechProvider), spoken replies come from /api/speak (vendor chosen server-side).
// If the cloud voice fails for any reason (rate limit, network, kill switch, autoplay block) the
// same text is read by the browser voice instead, so the reply is never silently lost.
import { chunkForCloud, stripForSpeech } from './textChunking';
import { WebSpeechProvider } from './webSpeechProvider';
import type { VoiceEvent, VoiceEventType, VoiceLang, VoiceProvider } from './types';

const SPEAK_ENDPOINT = '/api/speak';
// ~0.1 s of silence; played inside a user gesture to unlock audio playback on iOS/Safari.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export class CloudSpeechProvider implements VoiceProvider {
  readonly id = 'cloud';
  readonly mode = 'pipeline';

  private readonly inner = new WebSpeechProvider();
  private readonly listeners = new Map<VoiceEventType, Set<(e: VoiceEvent) => void>>();
  private currentLang: VoiceLang = 'en-US';
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private cloudActive = false;

  constructor() {
    for (const type of ['interim', 'transcript', 'agent-text', 'state', 'error'] as const) {
      this.inner.on(type, (e) => {
        // While the cloud voice is playing, the browser voice's idle events are not ours to forward.
        if (e.type === 'state' && this.cloudActive && e.state === 'idle') return;
        this.emit(e);
      });
    }
  }

  isSupported(): boolean {
    return this.inner.isSupported();
  }

  /** Cloud playback needs only an <audio> element, so it works even without speechSynthesis. */
  static isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && typeof Audio !== 'undefined';
  }

  getAudioLevel(): number {
    return this.inner.getAudioLevel();
  }

  on(event: VoiceEventType, cb: (e: VoiceEvent) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  private emit(event: VoiceEvent): void {
    this.listeners.get(event.type)?.forEach((cb) => cb(event));
  }

  /** Called from a click handler (mic / speaker button) so later async playback is allowed. */
  private unlockAudio(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.src = SILENT_WAV;
      this.audio.play().catch(() => {});
    }
    return this.audio;
  }

  setLang(lang: VoiceLang): void {
    this.currentLang = lang;
    this.inner.setLang(lang);
  }

  async start(opts: { lang: VoiceLang }): Promise<void> {
    this.currentLang = opts.lang;
    this.cancelSpeech();
    this.unlockAudio();
    return this.inner.start(opts);
  }

  stop(): void {
    this.inner.stop();
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private finishCloud(generation: number): void {
    if (generation !== this.generation || !this.cloudActive) return;
    this.cloudActive = false;
    this.releaseObjectUrl();
    this.emit({ type: 'state', state: 'idle' });
  }

  private async fetchAudio(text: string, signal: AbortSignal): Promise<Blob> {
    const res = await fetch(SPEAK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: this.currentLang }),
      signal,
    });
    if (!res.ok) throw new Error(`speak http ${res.status}`);
    return res.blob();
  }

  private playBlob(audio: HTMLAudioElement, blob: Blob): Promise<void> {
    this.releaseObjectUrl();
    this.objectUrl = URL.createObjectURL(blob);
    audio.src = this.objectUrl;
    return new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('audio error'));
      audio.play().catch(reject);
    });
  }

  async speak(text: string): Promise<void> {
    this.cancelSpeech();
    const cleaned = stripForSpeech(text);
    if (!cleaned) return;
    const chunks = chunkForCloud(cleaned);
    if (chunks.length === 0) return;

    const audio = this.unlockAudio();
    const generation = ++this.generation;
    this.cloudActive = true;
    this.emit({ type: 'state', state: 'speaking' });

    let played = 0;
    try {
      if (!audio) throw new Error('no audio element');
      const abort = new AbortController();
      this.abort = abort;
      // All chunks synthesize in parallel while earlier ones play, so only the first (short)
      // chunk is on the critical path to the first sound.
      const pending = chunks.map((chunk) => this.fetchAudio(chunk, abort.signal));
      pending.forEach((p) => p.catch(() => {})); // failures are handled when that chunk's turn comes

      for (const request of pending) {
        const blob = await request;
        if (generation !== this.generation) return;
        await this.playBlob(audio, blob);
        if (generation !== this.generation) return;
        played += 1;
      }
      this.finishCloud(generation);
    } catch {
      if (generation !== this.generation) return; // cancelled — not a failure
      // Cloud voice failed part-way: read what is left with the browser voice, never go silent.
      this.cloudActive = false;
      this.releaseObjectUrl();
      await this.inner.speak(chunks.slice(played).join(' '));
    }
  }

  cancelSpeech(): void {
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
    }
    this.releaseObjectUrl();
    this.inner.cancelSpeech();
    if (this.cloudActive) {
      this.cloudActive = false;
      this.emit({ type: 'state', state: 'idle' });
    }
  }
}
