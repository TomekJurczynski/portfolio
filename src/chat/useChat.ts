// Chat state machine (02-SPEC-TECHNICZNA.md §4.2–4.4): ready -> sending ->
// responding -> ready, with error states per the §4.4 table. Talks to
// POST /api/chat and reassembles its NDJSON stream.
import { useCallback, useEffect, useRef, useState } from 'react';
import { linkTargets, navTargets } from './actions.generated';
import { extractActions, stripMarkersForDisplay } from './markerParser';
import { openApp, scrollToSection } from '../scripts/nav';
import type { ChatAction, ChatErrorCode, ChatPhase } from './types';

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ChatAction[];
  interrupted?: boolean;
}

const STORAGE_KEY = 'chat:v1';
const MAX_HISTORY = 8;
const MAX_MESSAGE_LENGTH = 500;
const FIRST_TOKEN_TIMEOUT_MS = 15_000;
const DEFAULT_LOCK_MS = 60_000;

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadStoredMessages(): StoredMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredMessage[]) : [];
  } catch {
    return [];
  }
}

function persist(messages: StoredMessage[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage unavailable (private mode, quota) — chat still works, just
    // won't survive a reload. Not worth surfacing to the user.
  }
}

/** Drops actions whose id isn't in the build-time allow-list (§6.4: unknown ids are skipped). */
function filterKnownActions(actions: ChatAction[]): ChatAction[] {
  return actions.filter((a) =>
    a.kind === 'link' ? a.id in linkTargets : a.id in navTargets,
  );
}

function runAction(action: ChatAction): void {
  if (action.kind === 'nav') {
    if (action.id.startsWith('app-')) openApp(action.id.slice('app-'.length));
    else scrollToSection(action.id);
  }
}

export interface UseChatOptions {
  /** Called right after a nav action auto-runs (§4.3.6) — lets the UI collapse the mobile sheet. */
  onNavAction?: () => void;
}

export function useChat(lang: 'en' | 'pl', options: UseChatOptions = {}) {
  const { onNavAction } = options;
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>('ready');
  const [errorCode, setErrorCode] = useState<ChatErrorCode | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const messagesRef = useRef<StoredMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const userStoppedRef = useRef(false);
  const firstTokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMessages(loadStoredMessages());
  }, []);

  const updateMessages = useCallback((updater: (prev: StoredMessage[]) => StoredMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const runRequest = useCallback(
    (historyForPayload: StoredMessage[]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      userStoppedRef.current = false;
      setPhase('sending');
      setErrorCode(null);

      const payloadMessages = historyForPayload
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content }));

      firstTokenTimerRef.current = setTimeout(() => {
        controller.abort();
      }, FIRST_TOKEN_TIMEOUT_MS);

      const assistantId = genId();
      let rawText = '';
      let sawFirstToken = false;
      let sawDone = false;

      const clearFirstTokenTimer = (): void => {
        if (firstTokenTimerRef.current) {
          clearTimeout(firstTokenTimerRef.current);
          firstTokenTimerRef.current = null;
        }
      };

      void (async () => {
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: payloadMessages, uiLang: lang }),
            signal: controller.signal,
          });

          if (!res.ok) {
            clearFirstTokenTimer();
            if (res.status === 429) {
              const retryAfter = Number(res.headers.get('Retry-After'));
              setLockedUntil(Date.now() + (Number.isFinite(retryAfter) ? retryAfter * 1000 : DEFAULT_LOCK_MS));
              setErrorCode('rate_limited');
            } else if (res.status === 503 || res.status === 502) {
              setErrorCode('unavailable');
            } else {
              setErrorCode('internal');
            }
            setPhase('error');
            return;
          }

          if (!res.body) {
            clearFirstTokenTimer();
            setErrorCode('internal');
            setPhase('error');
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            if (!sawFirstToken) {
              sawFirstToken = true;
              clearFirstTokenTimer();
              setPhase('responding');
              updateMessages((prev) => [
                ...prev,
                { id: assistantId, role: 'assistant', content: '' },
              ]);
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) continue;
              let event: { type: string; text?: string; code?: string };
              try {
                event = JSON.parse(line);
              } catch {
                continue;
              }

              if (event.type === 'delta' && event.text) {
                rawText += event.text;
                const displayText = stripMarkersForDisplay(rawText);
                updateMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: displayText } : m)),
                );
              } else if (event.type === 'done') {
                sawDone = true;
              } else if (event.type === 'error') {
                throw new Error('upstream_error');
              }
            }
          }

          if (sawDone) {
            const { displayText, actions } = extractActions(rawText);
            const knownActions = filterKnownActions(actions);
            updateMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: displayText, actions: knownActions } : m,
              ),
            );
            setPhase('ready');
            const navAction = knownActions.find((a) => a.kind === 'nav');
            if (navAction) {
              runAction(navAction);
              onNavAction?.();
            }
          } else {
            // Stream closed before a `done` line — either the user hit Stop, or
            // the connection genuinely dropped.
            const { displayText, actions } = extractActions(rawText);
            updateMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: displayText, actions: filterKnownActions(actions), interrupted: true }
                  : m,
              ),
            );
            if (userStoppedRef.current) {
              setPhase('ready');
            } else {
              setErrorCode('interrupted');
              setPhase('error');
            }
          }
        } catch (err) {
          clearFirstTokenTimer();
          if (!sawFirstToken) {
            // Aborted (timeout or Stop) or failed before any content arrived.
            updateMessages((prev) => prev.filter((m) => m.id !== assistantId));
            if (userStoppedRef.current) {
              setPhase('ready');
            } else {
              setErrorCode('network');
              setPhase('error');
            }
          } else {
            const { displayText, actions } = extractActions(rawText);
            updateMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: displayText, actions: filterKnownActions(actions), interrupted: true }
                  : m,
              ),
            );
            if (userStoppedRef.current) {
              setPhase('ready');
            } else {
              setErrorCode('interrupted');
              setPhase('error');
            }
          }
          void err;
        } finally {
          abortRef.current = null;
        }
      })();
    },
    [lang, onNavAction, updateMessages],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;
      if (phase === 'sending' || phase === 'responding') return;

      const userMessage: StoredMessage = { id: genId(), role: 'user', content: trimmed };
      updateMessages((prev) => [...prev, userMessage]);
      runRequest([...messagesRef.current, userMessage]);
    },
    [phase, runRequest, updateMessages],
  );

  const stop = useCallback(() => {
    userStoppedRef.current = true;
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const current = messagesRef.current;
    const last = current[current.length - 1];
    const trimmed = last?.role === 'assistant' ? current.slice(0, -1) : current;
    updateMessages(() => trimmed);
    setLockedUntil(null);
    runRequest(trimmed);
  }, [runRequest, updateMessages]);

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    userStoppedRef.current = true;
    updateMessages(() => []);
    setPhase('ready');
    setErrorCode(null);
    setLockedUntil(null);
  }, [updateMessages]);

  return { messages, phase, errorCode, lockedUntil, send, stop, retry, newConversation };
}
