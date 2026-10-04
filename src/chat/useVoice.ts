// Thin React wrapper around a VoiceProvider (src/voice/). Kept separate from
// useChat's state machine on purpose — listening/speaking are audio I/O states
// that never overlap with the server exchange (ready/sending/responding/error),
// per the state diagram in 02-SPEC-TECHNICZNA.md §4.2/§5.1.
import { useCallback, useEffect, useState } from 'react';
import { createVoiceProvider } from '../voice';
import { CloudSpeechProvider } from '../voice/cloudSpeechProvider';
import { WebSpeechProvider } from '../voice/webSpeechProvider';
import type { VoiceErrorCode, VoiceLang, VoiceState } from '../voice/types';

export interface UseVoiceOptions {
  onTranscript?: (text: string) => void;
  onInterim?: (text: string) => void;
}

export function useVoice(lang: 'en' | 'pl', options: UseVoiceOptions = {}) {
  const { onTranscript, onInterim } = options;
  const [provider] = useState(() => createVoiceProvider());
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<VoiceErrorCode | null>(null);

  // Capability checks touch `window` — only safe post-mount (BaseLayout/Astro SSR).
  useEffect(() => {
    setCanListen(provider.isSupported());
    setCanSpeak(provider.mode === 'pipeline' &&
        (provider.id === 'cloud' ? CloudSpeechProvider.isSpeechSupported() : WebSpeechProvider.isSynthesisSupported()));
  }, [provider]);

  useEffect(() => {
    const offState = provider.on('state', (e) => {
      if (e.type === 'state') setState(e.state);
    });
    const offError = provider.on('error', (e) => {
      if (e.type === 'error') setError(e.code);
    });
    const offTranscript = provider.on('transcript', (e) => {
      if (e.type !== 'transcript') return;
      setError(null);
      onTranscript?.(e.text);
    });
    const offInterim = provider.on('interim', (e) => {
      if (e.type === 'interim') onInterim?.(e.text);
    });
    return () => {
      offState();
      offError();
      offTranscript();
      offInterim();
    };
  }, [provider, onTranscript, onInterim]);

  const voiceLang: VoiceLang = lang === 'pl' ? 'pl-PL' : 'en-US';

  // Read-aloud must follow the UI language even when the mic was never clicked.
  useEffect(() => {
    provider.setLang?.(voiceLang);
  }, [provider, voiceLang]);

  const start = useCallback(() => {
    setError(null);
    void provider.start({ lang: voiceLang });
  }, [provider, voiceLang]);

  const stop = useCallback(() => provider.stop(), [provider]);
  const speak = useCallback((text: string) => void provider.speak?.(text), [provider]);
  const cancelSpeech = useCallback(() => provider.cancelSpeech?.(), [provider]);

  // Not part of the shared VoiceProvider contract (only WebSpeechProvider has it,
  // purely for VoiceOrb's mic-reactive visual) — duck-typed rather than widening
  // the interface every future provider would have to implement.
  const getAudioLevel = useCallback((): number => {
    const withLevel = provider as unknown as { getAudioLevel?: () => number };
    return withLevel.getAudioLevel?.() ?? 0;
  }, [provider]);

  return { canListen, canSpeak, state, error, start, stop, speak, cancelSpeech, getAudioLevel };
}
