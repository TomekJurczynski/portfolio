import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import speak from '../../netlify/functions/speak';
import { voiceNameFor } from '../../netlify/functions/lib/tts';
import { MAX_SPEAK_CHARS, speakRequestSchema } from '../../netlify/functions/lib/validation';

const ctx = {} as never;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/speak', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('speakRequestSchema', () => {
  it('accepts en-US and pl-PL text', () => {
    expect(speakRequestSchema.safeParse({ text: 'Hi', lang: 'en-US' }).success).toBe(true);
    expect(speakRequestSchema.safeParse({ text: 'Cześć', lang: 'pl-PL' }).success).toBe(true);
  });
  it('rejects empty, oversized and unknown-language input', () => {
    expect(speakRequestSchema.safeParse({ text: '   ', lang: 'en-US' }).success).toBe(false);
    expect(speakRequestSchema.safeParse({ text: 'x'.repeat(MAX_SPEAK_CHARS + 1), lang: 'en-US' }).success).toBe(false);
    expect(speakRequestSchema.safeParse({ text: 'Hi', lang: 'de-DE' }).success).toBe(false);
  });
});

describe('voiceNameFor', () => {
  it('builds the Chirp 3 HD name with the default voice', () => {
    expect(voiceNameFor('pl-PL', {})).toBe('pl-PL-Chirp3-HD-Aoede');
  });
  it('uses a per-language env override and ignores malformed values', () => {
    expect(voiceNameFor('pl-PL', { TTS_VOICE_PL: 'Kore' })).toBe('pl-PL-Chirp3-HD-Kore');
    expect(voiceNameFor('en-US', { TTS_VOICE_EN: 'Puck' })).toBe('en-US-Chirp3-HD-Puck');
    expect(voiceNameFor('en-US', { TTS_VOICE_EN: '../evil' })).toBe('en-US-Chirp3-HD-Aoede');
  });
});

describe('POST /api/speak', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GOOGLE_TTS_API_KEY', 'test-key');
    vi.stubEnv('ALLOWED_ORIGINS', '');
    vi.stubEnv('TTS_ENABLED', '');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns MP3 bytes and calls Google with key header, voice and language', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ audioContent: Buffer.from('mp3-bytes').toString('base64') })),
    );
    const res = await speak(post({ text: 'Cześć', lang: 'pl-PL' }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('mp3-bytes');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const sent = JSON.parse(init.body as string);
    expect(sent.voice).toEqual({ languageCode: 'pl-PL', name: 'pl-PL-Chirp3-HD-Aoede' });
    expect(sent.audioConfig.audioEncoding).toBe('MP3');
  });

  it('rejects bad method, content type, body and origin before calling Google', async () => {
    expect((await speak(new Request('http://localhost/api/speak'), ctx)).status).toBe(405);
    expect((await speak(post('nope', { 'content-type': 'text/plain' }), ctx)).status).toBe(415);
    expect((await speak(post('{not json'), ctx)).status).toBe(400);
    expect((await speak(post({ text: '', lang: 'en-US' }), ctx)).status).toBe(400);
    vi.stubEnv('ALLOWED_ORIGINS', 'https://good.example');
    expect((await speak(post({ text: 'Hi', lang: 'en-US' }, { origin: 'https://evil.example' }), ctx)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honours the kill switch and a missing key', async () => {
    vi.stubEnv('TTS_ENABLED', 'false');
    expect((await speak(post({ text: 'Hi', lang: 'en-US' }), ctx)).status).toBe(503);
    vi.stubEnv('TTS_ENABLED', '');
    vi.stubEnv('GOOGLE_TTS_API_KEY', '');
    expect((await speak(post({ text: 'Hi', lang: 'en-US' }), ctx)).status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an upstream failure to 502 without leaking the Google error body', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"secret detail"}', { status: 403 }));
    const res = await speak(post({ text: 'Hi', lang: 'en-US' }), ctx);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret');
  });
});

describe('POST /api/speak with TTS_PROVIDER=elevenlabs', () => {
  const fetchMock = vi.fn();
  const VOICE = 'abcdefghij1234567890';
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('TTS_PROVIDER', 'elevenlabs');
    vi.stubEnv('ELEVENLABS_API_KEY', 'el-key');
    vi.stubEnv('ELEVENLABS_VOICE_PL', VOICE);
    vi.stubEnv('ELEVENLABS_VOICE_EN', '');
    vi.stubEnv('ELEVENLABS_MODEL', '');
    vi.stubEnv('GOOGLE_TTS_API_KEY', '');
    vi.stubEnv('ALLOWED_ORIGINS', '');
    vi.stubEnv('TTS_ENABLED', '');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('calls ElevenLabs with key header, voice id and model, and returns the raw MP3', async () => {
    fetchMock.mockResolvedValue(new Response(Buffer.from('raw-mp3')));
    const res = await speak(post({ text: 'Cześć', lang: 'pl-PL' }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('raw-mp3');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`);
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('el-key');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'Cześć', model_id: 'eleven_multilingual_v2' });
  });

  it('uses a valid ELEVENLABS_MODEL and ignores a malformed one', async () => {
    fetchMock.mockImplementation(async () => new Response(Buffer.from('x')));
    vi.stubEnv('ELEVENLABS_MODEL', 'eleven_flash_v2_5');
    await speak(post({ text: 'Hi', lang: 'pl-PL' }), ctx);
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).model_id).toBe('eleven_flash_v2_5');
    vi.stubEnv('ELEVENLABS_MODEL', '../evil');
    await speak(post({ text: 'Hi', lang: 'pl-PL' }), ctx);
    expect(JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string).model_id).toBe('eleven_multilingual_v2');
  });

  it('fails cleanly without the key or without a voice for the language, never calling out', async () => {
    expect((await speak(post({ text: 'Hi', lang: 'en-US' }), ctx)).status).toBe(500); // no EN voice
    vi.stubEnv('ELEVENLABS_API_KEY', '');
    expect((await speak(post({ text: 'Hi', lang: 'pl-PL' }), ctx)).status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an upstream failure to 502 without leaking the body', async () => {
    fetchMock.mockResolvedValue(new Response('{"detail":"quota secret"}', { status: 401 }));
    const res = await speak(post({ text: 'Hi', lang: 'pl-PL' }), ctx);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret');
  });

  it('logs only the short ElevenLabs reason code, never the message', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      new Response('{"detail":{"status":"paid_plan_required","message":"secret detail"}}', { status: 402 }),
    );
    expect((await speak(post({ text: 'Hi', lang: 'pl-PL' }), ctx)).status).toBe(502);
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).toContain('tts http 402 paid_plan_required');
    expect(logged).not.toContain('secret');
  });
});
