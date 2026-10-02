// The client-supplied conversation history is untrusted data, not instructions
// (02-SPEC-TECHNICZNA.md §6.1): a forged assistant turn in the history could try
// to plant {{link:...}}/{{nav:...}} action markers for the model to echo back as
// if it had genuinely decided to emit them. Stripping the marker delimiters from
// every message before it reaches the model closes that off.
import type { ChatMessage } from './validation.ts';

export function sanitizeHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    content: message.content.replaceAll('{{', '').replaceAll('}}', ''),
  }));
}
