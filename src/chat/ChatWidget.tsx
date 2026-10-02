import { useCallback, useEffect, useId, useRef, useState } from 'react';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import { useChat } from './useChat';
import en from '../i18n/en.json';
import pl from '../i18n/pl.json';
import type { I18n } from '../i18n/types';
import type { ChatErrorCode } from './types';
import suggestionsData from '../../content/agent/suggestions.json';
import './chat.css';

interface Props {
  lang: 'en' | 'pl';
  email: string;
}

function errorMessageFor(code: ChatErrorCode, i18n: I18n): string {
  switch (code) {
    case 'rate_limited':
      return i18n.chat.errorRateLimited;
    case 'unavailable':
      return i18n.chat.errorUnavailable;
    case 'network':
      return i18n.chat.errorNetwork;
    case 'interrupted':
      return i18n.chat.errorInterrupted;
    default:
      return i18n.chat.errorGeneric;
  }
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

export default function ChatWidget({ lang, email }: Props) {
  const i18n: I18n = lang === 'pl' ? pl : en;
  const suggestions = suggestionsData[lang];

  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [draft, setDraft] = useState('');
  const [isLockActive, setIsLockActive] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const closePanel = useCallback(() => {
    setIsOpen(false);
    (lastFocusedRef.current ?? launcherRef.current)?.focus();
  }, []);

  const { messages, phase, errorCode, lockedUntil, send, stop, retry, newConversation } = useChat(
    lang,
    { onNavAction: () => isMobile && closePanel() },
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const update = (): void => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const openPanel = useCallback(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  }, []);

  // Hero's "Ask the agent" CTA (data-chat-cta) opens this panel; falls back to
  // its href="#contact" if this hasn't hydrated yet (progressive enhancement).
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (!(e.target instanceof HTMLElement)) return;
      if (!e.target.closest('[data-chat-cta]')) return;
      e.preventDefault();
      openPanel();
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openPanel]);

  // Focus on open, Esc to close from anywhere, Tab-trap only in the mobile (modal) sheet.
  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();

    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closePanel();
        return;
      }
      if (!isMobile || e.key !== 'Tab' || !panelRef.current) return;
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [isOpen, isMobile, closePanel]);

  useEffect(() => {
    if (!lockedUntil) {
      setIsLockActive(false);
      return;
    }
    const remaining = lockedUntil - Date.now();
    if (remaining <= 0) {
      setIsLockActive(false);
      return;
    }
    setIsLockActive(true);
    const timer = setTimeout(() => setIsLockActive(false), remaining);
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  const handleSend = (): void => {
    if (!draft.trim()) return;
    send(draft);
    setDraft('');
  };

  const isBusy = phase === 'sending' || phase === 'responding';
  const canRetry = errorCode === 'network' || errorCode === 'interrupted';
  const inputDisabled = isLockActive || (phase === 'error' && errorCode === 'unavailable');

  return (
    <div className="chat-widget">
      <button
        ref={launcherRef}
        type="button"
        className="chat-launcher"
        data-open={isOpen}
        onClick={openPanel}
        aria-hidden={isOpen}
        tabIndex={isOpen ? -1 : 0}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.4 10.2 12.6 4.5 10.8l5.7-1.8L12 3.5Z"
            fill="currentColor"
          />
        </svg>
        {i18n.chat.launcher}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="chat-panel"
          role="dialog"
          aria-modal={isMobile}
          aria-labelledby={titleId}
        >
          <header className="chat-panel__header">
            <h2 id={titleId}>{i18n.chat.title}</h2>
            <div className="chat-panel__header-actions">
              <button
                type="button"
                className="chat-icon-btn"
                onClick={newConversation}
                aria-label={i18n.chat.newConversation}
                title={i18n.chat.newConversation}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12a8 8 0 1 1 2.5 5.8M4 12V7m0 5h5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="chat-icon-btn"
                onClick={closePanel}
                aria-label={i18n.chat.close}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </header>

          <MessageList
            i18n={i18n}
            messages={messages}
            phase={phase}
            emptyState={
              <div className="chat-empty">
                <p>{i18n.chat.welcome}</p>
                <div className="chat-suggestions">
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="chat-suggestion-chip"
                      onClick={() => send(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            }
          />

          {phase === 'error' && errorCode && (
            <div className="chat-error" role="alert">
              <p>{errorMessageFor(errorCode, i18n)}</p>
              <div className="chat-error__actions">
                {canRetry && (
                  <button type="button" className="chat-error__retry" onClick={retry}>
                    {i18n.chat.retry}
                  </button>
                )}
                <a className="chat-error__email" href={`mailto:${email}`}>
                  {i18n.chat.emailFallback}
                </a>
              </div>
            </div>
          )}

          <ChatInput
            i18n={i18n}
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            onStop={stop}
            isBusy={isBusy}
            disabled={inputDisabled}
          />
          <p className="chat-disclaimer">{i18n.chat.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
