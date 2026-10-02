// LLMProvider interface (02-SPEC-TECHNICZNA.md §6.3) + the first implementation,
// backed by the official Anthropic SDK. Swapping providers later (R8) means a new
// class behind this same interface, not changes anywhere else in chat.ts.
import Anthropic from '@anthropic-ai/sdk';

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMStreamInput {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}

export interface LLMProvider {
  stream(input: LLMStreamInput): AsyncIterable<string>;
}

export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(model: string, apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async *stream(input: LLMStreamInput): AsyncIterable<string> {
    const messageStream = this.client.messages.stream(
      {
        model: this.model,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        // The system block is cache-marked per PID/SRS §6.1's cost model: it's the
        // same knowledge text on every request, so repeat conversations within the
        // 5-minute cache window cost a fraction of the uncached input-token rate.
        system: [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }],
        messages: input.messages,
      },
      { signal: input.signal },
    );

    for await (const event of messageStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}
