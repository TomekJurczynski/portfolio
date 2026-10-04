// POST /api/speak — text → MP3 via Google Chirp 3 HD. Same guard rails as /api/chat (origin
// allow-list, body cap, rate limit, kill switch); logs only status/timing/char-count (NFR-14).
import type { Config, Context } from '@netlify/functions';
import { isOriginAllowed, parseAllowedOrigins } from './lib/origin.ts';
import {
  elevenLabsModelFor,
  elevenLabsVoiceFor,
  synthesizeElevenLabs,
  synthesizeSpeech,
  ttsApiKeyFor,
  ttsProviderFrom,
  voiceNameFor,
} from './lib/tts.ts';
import { speakRequestSchema } from './lib/validation.ts';

export const config: Config = {
  path: '/api/speak',
  rateLimit: { windowLimit: 120, windowSize: 3600, aggregateBy: ['ip', 'domain'] },
};

const MAX_BODY_BYTES = 8 * 1024;

function jsonError(status: number, code: string): Response {
  return new Response(JSON.stringify({ type: 'error', code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const start = Date.now();

  if (req.method !== 'POST') return jsonError(405, 'method_not_allowed');

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return jsonError(415, 'unsupported_media');

  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const origin = req.headers.get('origin');
  if (allowedOrigins.length > 0 && origin && !isOriginAllowed(origin, allowedOrigins)) {
    return jsonError(403, 'forbidden_origin');
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) return jsonError(413, 'too_large');

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return jsonError(400, 'invalid_request');
  }
  const result = speakRequestSchema.safeParse(parsedBody);
  if (!result.success) return jsonError(400, 'invalid_request');

  if (process.env.TTS_ENABLED === 'false') return jsonError(503, 'unavailable');

  const provider = ttsProviderFrom(process.env);
  const apiKey = ttsApiKeyFor(provider, process.env);
  if (!apiKey) {
    console.error(`speak: API key for ${provider} is not set`);
    return jsonError(500, 'internal');
  }

  const { text, lang } = result.data;
  let errorCode: string | null = null;
  try {
    let audio: Uint8Array<ArrayBuffer>;
    if (provider === 'elevenlabs') {
      const voiceId = elevenLabsVoiceFor(lang, process.env);
      if (!voiceId) {
        console.error(`speak: ELEVENLABS_VOICE_${lang === 'pl-PL' ? 'PL' : 'EN'} is not set`);
        errorCode = 'misconfigured';
        return jsonError(500, 'internal');
      }
      audio = await synthesizeElevenLabs({
        text,
        voiceId,
        modelId: elevenLabsModelFor(process.env),
        apiKey,
        signal: req.signal,
      });
    } else {
      audio = await synthesizeSpeech({
        text,
        lang,
        voiceName: voiceNameFor(lang, process.env),
        apiKey,
        signal: req.signal,
      });
    }
    return new Response(audio, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    errorCode = 'upstream_error';
    console.error('speak upstream error', err instanceof Error ? err.message : String(err));
    return jsonError(502, 'upstream_error');
  } finally {
    console.log(
      JSON.stringify({ route: 'speak', provider, durationMs: Date.now() - start, chars: text.length, lang, errorCode }),
    );
  }
};
