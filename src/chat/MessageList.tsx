import { useEffect, useRef, useState } from 'react';
import { linkLabels, linkTargets } from './actions.generated';
import type { StoredMessage } from './useChat';
import type { ChatAction, ChatPhase } from './types';
import type { I18n } from '../i18n/types';

const SCROLL_PIN_THRESHOLD = 48;

interface Props {
  i18n: I18n;
  messages: StoredMessage[];
  phase: ChatPhase;
  emptyState: React.ReactNode;
}

function navLabel(id: string, i18n: I18n): string {
  if (id === 'about') return i18n.nav.about;
  if (id === 'apps') return i18n.nav.apps;
  if (id === 'cv') return i18n.nav.cv;
  if (id === 'contact') return i18n.nav.contact;
  if (id.startsWith('app-')) return linkLabels[id.slice(4) as keyof typeof linkLabels] ?? id;
  return id;
}

function ActionChip({ action, i18n }: { action: ChatAction; i18n: I18n }) {
  if (action.kind === 'link') {
    const target = linkTargets[action.id as keyof typeof linkTargets];
    if (!target) return null;
    const label = linkLabels[action.id as keyof typeof linkLabels] ?? action.id;
    return (
      <a
        className="chat-action-chip"
        href={target.href}
        target={target.external ? '_blank' : undefined}
        rel={target.external ? 'noopener noreferrer' : undefined}
      >
        {label}
        {target.external && (
          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24">
            <path
              d="M7 17 17 7M9 7h8v8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        )}
      </a>
    );
  }
  return (
    <a className="chat-action-chip" href={`#${action.id}`}>
      {navLabel(action.id, i18n)}
    </a>
  );
}

export default function MessageList({ i18n, messages, phase, emptyState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showJumpToNew, setShowJumpToNew] = useState(false);

  const scrollToBottom = (): void => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    pinnedRef.current = true;
    setShowJumpToNew(false);
  };

  useEffect(() => {
    if (pinnedRef.current) {
      scrollToBottom();
    } else {
      setShowJumpToNew(true);
    }
  }, [messages]);

  const handleScroll = (): void => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < SCROLL_PIN_THRESHOLD;
    pinnedRef.current = atBottom;
    if (atBottom) setShowJumpToNew(false);
  };

  return (
    <div className="chat-messages-wrap">
      <div
        ref={containerRef}
        className="chat-messages"
        role="log"
        aria-live="polite"
        aria-busy={phase === 'responding'}
        onScroll={handleScroll}
      >
        {messages.length === 0
          ? emptyState
          : messages.map((m) => (
              <div key={m.id} className={`chat-msg chat-msg--${m.role}`}>
                <p className="chat-msg__text">
                  {m.content}
                  {phase === 'responding' &&
                    m.role === 'assistant' &&
                    m.id === messages[messages.length - 1]?.id && <span className="chat-cursor" />}
                </p>
                {m.interrupted && <p className="chat-msg__note">{i18n.chat.interruptedNote}</p>}
                {m.actions && m.actions.length > 0 && (
                  <div className="chat-actions-row">
                    {m.actions.map((a) => (
                      <ActionChip key={`${a.kind}:${a.id}`} action={a} i18n={i18n} />
                    ))}
                  </div>
                )}
              </div>
            ))}
      </div>
      {showJumpToNew && (
        <button type="button" className="chat-jump-new" onClick={scrollToBottom}>
          {i18n.chat.newMessages}
        </button>
      )}
    </div>
  );
}
