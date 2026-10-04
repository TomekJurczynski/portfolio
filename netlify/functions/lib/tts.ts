// Google Cloud Text-to-Speech (Chirp 3 HD) over plain REST — one fetch, no SDK, so the function
// bundle stays tiny and the API key stays a header value we fully control.
import type { SpeakRequest } from './validation.ts';

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

// Chirp 3 HD voice names are `<locale>-Chirp3-HD-<Voice>`; the voice part is overridable per
// language via env so the voice can be changed in the Netlify dashboard without a redeploy.
const DEFAULT_VOICES: Record<SpeakRequest['lang'], string> = {
  'en-US': 'Aoede',
  'pl-PL': 'Aoede',
};

export function voiceNameFor(lang: SpeakRequest['lang'], env: Record<string, string | undefined>): string {
  const override = lang === 'pl-PL' ? env.TTS_VOICE_PL : env.TTS_VOICE_EN;
  const voice = /^[A-Za-z]{2,20}$/.test(override ?? '') ? (override as string) : DEFAULT_VOICES[lang];
  return `${lang}-Chirp3-HD-${voice}`;
}

export async function synthesizeSpeech(opts: {
  text: string;
  lang: SpeakRequest['lang'];
  voiceName: string;
  apiKey: string;
  /** Gemini-TTS only: model id (voiceName is then just the voice, e.g. "Leda") and a style instruction. */
  modelName?: string;
  prompt?: string;
  signal?: AbortSignal;
}): Promise<Uint8Array<ArrayBuffer>> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify({
      input: opts.prompt ? { text: opts.text, prompt: opts.prompt } : { text: opts.text },
      voice: {
        languageCode: opts.lang,
        name: opts.voiceName,
        ...(opts.modelName ? { modelName: opts.modelName } : {}),
      },
      audioConfig: { audioEncoding: 'MP3' },
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    // Never include the response body: Google error payloads can echo request details.
    throw new Error(`tts http ${res.status}`);
  }
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error('tts empty audio');
  return Uint8Array.from(Buffer.from(data.audioContent, 'base64'));
}

// ---------------------------------------------------------------------------------------------
// Provider selection. Google Chirp 3 HD is the default; ElevenLabs is opt-in via TTS_PROVIDER so
// the vendor can be switched in the Netlify dashboard without a code change. Both return MP3.
export type TtsProvider = 'google' | 'elevenlabs';

type Env = Record<string, string | undefined>;

export function ttsProviderFrom(env: Env): TtsProvider {
  return env.TTS_PROVIDER === 'elevenlabs' ? 'elevenlabs' : 'google';
}

export function ttsApiKeyFor(provider: TtsProvider, env: Env): string | undefined {
  return (provider === 'elevenlabs' ? env.ELEVENLABS_API_KEY : env.GOOGLE_TTS_API_KEY) || undefined;
}

const ELEVENLABS_DEFAULT_MODEL = 'eleven_multilingual_v2';

/** Voice ids and model ids come from env — accept only plain ids so env can't inject path/query. */
export function elevenLabsVoiceFor(lang: SpeakRequest['lang'], env: Env): string | undefined {
  const id = lang === 'pl-PL' ? env.ELEVENLABS_VOICE_PL : env.ELEVENLABS_VOICE_EN;
  return /^[A-Za-z0-9]{10,40}$/.test(id ?? '') ? id : undefined;
}

export function elevenLabsModelFor(env: Env): string {
  return /^eleven_[a-z0-9_]{2,40}$/.test(env.ELEVENLABS_MODEL ?? '') ? (env.ELEVENLABS_MODEL as string) : ELEVENLABS_DEFAULT_MODEL;
}

export async function synthesizeElevenLabs(opts: {
  text: string;
  voiceId: string;
  modelId: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<Uint8Array<ArrayBuffer>> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': opts.apiKey },
      body: JSON.stringify({ text: opts.text, model_id: opts.modelId }),
      signal: opts.signal,
    },
  );
  if (!res.ok) {
    // Never log the body. ElevenLabs puts a short machine code in detail.status (e.g.
    // "paid_plan_required"); only that code, only if it is a plain snake_case token, is kept.
    let reason = '';
    try {
      const status = ((await res.json()) as { detail?: { status?: unknown } }).detail?.status;
      if (typeof status === 'string' && /^[a-z_]{3,40}$/.test(status)) reason = ` ${status}`;
    } catch {
      // not JSON — no reason code
    }
    throw new Error(`tts http ${res.status}${reason}`);
  }
  const audio = new Uint8Array(await res.arrayBuffer());
  if (audio.length === 0) throw new Error('tts empty audio');
  return audio;
}
