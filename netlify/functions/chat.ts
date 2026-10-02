// POST /api/chat — the only point of contact between the browser and the model
// (02-SPEC-TECHNICZNA.md §6). Validates input, builds the prompt from pre-baked
// build-time content, streams the model's reply as NDJSON, and logs nothing but
// status/timing/char-count (NFR-14 — no message content in logs, ever).
import type { Config, Context } from '@netlify/functions';
import { buildSystemPrompt } from './lib/system-prompt.generated.ts';
import { sanitizeHistory } from './lib/guard.ts';
import { AnthropicProvider } from './lib/llm.ts';
import { isOriginAllowed, parseAllowedOrigins } from './lib/origin.ts';
import { chatRequestSchema } from './lib/validation.ts';

export const config: Config = {
  path: '/api/chat',
  rateLimit: { windowLimit: 20, windowSize: 3600, aggregateBy: ['ip', 'domain'] },
};

const MAX_BODY_BYTES = 8 * 1024;
const MODEL_ID = process.env.MODEL_ID ?? 'claude-haiku-4-5-20251001';
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS ?? 400);
const TEMPERATURE = 0.3;

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
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonError(415, 'unsupported_media');
  }

  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const origin = req.headers.get('origin');
  if (allowedOrigins.length > 0 && origin && !isOriginAllowed(origin, allowedOrigins)) {
    return jsonError(403, 'forbidden_origin');
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return jsonError(413, 'too_large');
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return jsonError(400, 'invalid_request');
  }

  const result = chatRequestSchema.safeParse(parsedBody);
  if (!result.success) return jsonError(400, 'invalid_request');

  if (process.env.CHAT_ENABLED === 'false') return jsonError(503, 'unavailable');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('chat: ANTHROPIC_API_KEY is not set');
    return jsonError(500, 'internal');
  }

  const { messages, uiLang } = result.data;
  const history = sanitizeHistory(messages).slice(-8);
  const system = buildSystemPrompt(uiLang);
  const provider = new AnthropicProvider(MODEL_ID, apiKey);

  const encoder = new TextEncoder();
  let outputChars = 0;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let errorCode: string | null = null;
      try {
        for await (const delta of provider.stream({
          system,
          messages: history,
          maxTokens: MAX_OUTPUT_TOKENS,
          temperature: TEMPERATURE,
        })) {
          outputChars += delta.length;
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', text: delta }) + '\n'));
        }
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
      } catch (err) {
        errorCode = 'upstream_error';
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', code: 'upstream_error' }) + '\n'));
        console.error('chat upstream error', err instanceof Error ? err.message : String(err));
      } finally {
        controller.close();
        console.log(
          JSON.stringify({
            route: 'chat',
            status: 200,
            durationMs: Date.now() - start,
            outputChars,
            errorCode,
          }),
        );
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
    },
  });
};
