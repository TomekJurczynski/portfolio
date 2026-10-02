// Scriptable VoiceProvider for tests (AC-10: a mock provider swaps in with one
// config value, no UI/logic changes) — never touches a real Web Speech API.
import type { VoiceEvent, VoiceEventType, VoiceLang, VoiceProvider } from './types';

export class MockVoiceProvider implements VoiceProvider {
  readonly id = 'web-speech';
  readonly mode = 'pipeline';

  supported = true;
  started = false;
  lastLang: VoiceLang | null = null;
  spoken: string[] = [];

  private listeners = new Map<VoiceEventType, Set<(e: VoiceEvent) => void>>();

  isSupported(): boolean {
    return this.supported;
  }

  on(event: VoiceEventType, cb: (e: VoiceEvent) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  /** Test helper: push a scripted event out to subscribers. */
  emit(event: VoiceEvent): void {
    this.listeners.get(event.type)?.forEach((cb) => cb(event));
  }

  async start(opts: { lang: VoiceLang }): Promise<void> {
    this.started = true;
    this.lastLang = opts.lang;
    this.emit({ type: 'state', state: 'listening' });
  }

  stop(): void {
    this.started = false;
    this.emit({ type: 'state', state: 'idle' });
  }

  async speak(text: string): Promise<void> {
    this.spoken.push(text);
    this.emit({ type: 'state', state: 'speaking' });
    this.emit({ type: 'state', state: 'idle' });
  }

  cancelSpeech(): void {
    this.emit({ type: 'state', state: 'idle' });
  }
}
