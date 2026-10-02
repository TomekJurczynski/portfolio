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
