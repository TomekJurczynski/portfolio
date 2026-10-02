import { useEffect, useRef } from 'react';
import VoiceOrb from './VoiceOrb';
import type { I18n } from '../i18n/types';
import type { VoiceState } from '../voice/types';

const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = 400;
const ORB_SIZE = 40; // matches the send button so the row stays visually aligned

interface Props {
  i18n: I18n;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isBusy: boolean;
  disabled: boolean;
  showMic: boolean;
  voiceState: VoiceState;
  getVoiceAudioLevel: () => number;
  onMicToggle: () => void;
}

export default function ChatInput({
  i18n,
  value,
  onChange,
  onSend,
  onStop,
  isBusy,
  disabled,
  showMic,
  voiceState,
  getVoiceAudioLevel,
  onMicToggle,
}: Props) {
  const isListening = voiceState === 'listening';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTouchRef = useRef(false);

  useEffect(() => {
    isTouchRef.current = window.matchMedia('(pointer: coarse)').matches;
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Re-measures on both text changes and browser window resizes — narrowing the
    // window rewraps existing text onto more lines, which changes the height a
    // fixed [value]-only effect would never notice.
    const resize = (): void => {
      el.style.height = 'auto';
      const maxHeight = 4 * 22 + 16;
      // Only show the scrollbar once content genuinely needs it — a static
      // `overflow-y: auto` would flash the browser's native scrollbar on any
      // 1px rounding mismatch between scrollHeight and the height we set below.
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
      const grown = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${Math.max(grown, 40)}px`; // 40px matches the send button so a single empty/short line stays aligned
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [value]);

  const canSend = value.trim().length > 0 && value.length <= MAX_LENGTH && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== 'Enter') return;
    if (isTouchRef.current) return; // touch: Enter always inserts a newline
    if (e.shiftKey) return; // desktop: Shift+Enter inserts a newline
    e.preventDefault();
    if (canSend) onSend();
  };

  return (
    <div className="chat-input">
      <div className="chat-input__field">
        <textarea
          ref={textareaRef}
          className={isListening ? 'chat-input__textarea--listening' : undefined}
          value={value}
          maxLength={MAX_LENGTH}
          placeholder={i18n.chat.placeholder}
          aria-label={i18n.chat.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        {value.length >= COUNTER_THRESHOLD && (
          <span className="chat-input__counter">
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
      {showMic && (
        <VoiceOrb
          state={voiceState}
          size={ORB_SIZE}
          onClick={onMicToggle}
          disabled={disabled || isBusy}
          ariaLabel={isListening ? i18n.chat.micStop : i18n.chat.micStart}
          getAudioLevel={getVoiceAudioLevel}
        />
      )}
      {isBusy ? (
        <button type="button" className="chat-input__send chat-input__send--stop" onClick={onStop}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
            <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
          </svg>
          <span className="visually-hidden">{i18n.chat.stop}</span>
        </button>
      ) : (
        <button
          type="button"
          className="chat-input__send"
          disabled={!canSend}
          onClick={onSend}
          aria-label={i18n.chat.send}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12 20 4l-6 16-2.5-7L4 12Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
