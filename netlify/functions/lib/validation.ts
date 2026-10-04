// Request schema for POST /api/chat (02-SPEC-TECHNICZNA.md §6.1).
import { z } from 'zod';

const userMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string().min(1).max(500),
});

const assistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.string().min(1).max(2000),
});

export const chatRequestSchema = z
  .object({
    messages: z.array(z.union([userMessageSchema, assistantMessageSchema])).min(1).max(8),
    uiLang: z.enum(['en', 'pl']),
  })
  .refine((data) => data.messages[data.messages.length - 1]?.role === 'user', {
    message: 'the last message must have role "user"',
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = ChatRequest['messages'][number];

// Request schema for POST /api/speak. One call = one whole assistant reply, so the cap sits a
// bit under the 2000-char assistant message limit above (markers/URLs are stripped client-side).
export const MAX_SPEAK_CHARS = 1500;

export const speakRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_SPEAK_CHARS),
  lang: z.enum(['en-US', 'pl-PL']),
});

export type SpeakRequest = z.infer<typeof speakRequestSchema>;
