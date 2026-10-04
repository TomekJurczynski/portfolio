// VoiceProvider contract (02-SPEC-TECHNICZNA.md §5.4) — pipeline mode (Web Speech,
// this round) and realtime mode (ElevenLabs/OpenAI/Gemini, later) share this same
// shape so swapping providers never touches UI or chat logic (FR-34).
export type VoiceLang = 'en-US' | 'pl-PL';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking';

export type VoiceErrorCode =
  | 'not-allowed'
  | 'service-not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'language-not-supported'
  | 'aborted'
  | 'unknown';

export type VoiceEvent =
  | { type: 'interim'; text: string }
  | { type: 'transcript'; text: string }
  | { type: 'agent-text'; text: string }
  | { type: 'state'; state: VoiceState }
  | { type: 'error'; code: VoiceErrorCode; message: string };

export type VoiceEventType = VoiceEvent['type'];

export interface VoiceProvider {
  readonly id: 'web-speech' | 'cloud' | 'elevenlabs' | 'openai-realtime' | 'gemini-live';
  readonly mode: 'pipeline' | 'realtime';
  isSupported(): boolean;
  /** Language for read-aloud; the UI language can change without the mic ever being used. */
  setLang?(lang: VoiceLang): void;
  start(opts: { lang: VoiceLang }): Promise<void>;
  stop(): void;
  speak?(text: string): Promise<void>;
  cancelSpeech?(): void;
  /** Realtime mode only — sends typed text into an already-open voice session. */
  sendText?(text: string): void;
  on(event: VoiceEventType, cb: (e: VoiceEvent) => void): () => void;
}
