import { describe, expect, it } from 'vitest';
import { chatRequestSchema } from '../../netlify/functions/lib/validation';

const user = (content: string) => ({ role: 'user' as const, content });
const assistant = (content: string) => ({ role: 'assistant' as const, content });

describe('chatRequestSchema', () => {
  it('accepts a minimal valid request', () => {
    const result = chatRequestSchema.safeParse({ messages: [user('Hi')], uiLang: 'en' });
    expect(result.success).toBe(true);
  });

  it('accepts alternating history ending in a user message', () => {
    const result = chatRequestSchema.safeParse({
      messages: [user('Hi'), assistant('Hello'), user('Tell me about Sprout')],
      uiLang: 'pl',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a request with zero messages', () => {
    expect(chatRequestSchema.safeParse({ messages: [], uiLang: 'en' }).success).toBe(false);
  });

  it('rejects more than 8 messages', () => {
    const messages = Array.from({ length: 9 }, (_, i) => (i % 2 === 0 ? user('x') : assistant('y')));
    expect(chatRequestSchema.safeParse({ messages, uiLang: 'en' }).success).toBe(false);
  });

  it('rejects when the last message is not from the user', () => {
    const result = chatRequestSchema.safeParse({
      messages: [user('Hi'), assistant('Hello')],
      uiLang: 'en',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a user message over 500 characters', () => {
    const result = chatRequestSchema.safeParse({ messages: [user('a'.repeat(501))], uiLang: 'en' });
    expect(result.success).toBe(false);
  });

  it('rejects an assistant message over 2000 characters', () => {
    const result = chatRequestSchema.safeParse({
      messages: [assistant('a'.repeat(2001)), user('hi')],
      uiLang: 'en',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown uiLang', () => {
    const result = chatRequestSchema.safeParse({ messages: [user('Hi')], uiLang: 'fr' });
    expect(result.success).toBe(false);
  });
});
