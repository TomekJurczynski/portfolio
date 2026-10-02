export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatPhase = 'ready' | 'sending' | 'responding' | 'error';

export type ChatErrorCode =
  | 'rate_limited'
  | 'unavailable'
  | 'network'
  | 'interrupted'
  | 'invalid_request'
  | 'internal';

export interface ChatAction {
  kind: 'link' | 'nav';
  id: string;
}
