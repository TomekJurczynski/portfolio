// Provider selection (02-SPEC-TECHNICZNA.md §5.4): one build-time value picks the
// adapter. Swapping to a realtime provider later (ElevenLabs/OpenAI/Gemini) means
// adding a case here, not touching useVoice/ChatWidget.
import { CloudSpeechProvider } from './cloudSpeechProvider';
import { WebSpeechProvider } from './webSpeechProvider';
import type { VoiceProvider } from './types';

export function createVoiceProvider(): VoiceProvider {
  const providerId = import.meta.env.PUBLIC_VOICE_PROVIDER || 'web-speech';
  switch (providerId) {
    case 'cloud':
    case 'google-chirp': // legacy alias
      return new CloudSpeechProvider();
    case 'web-speech':
    default:
      return new WebSpeechProvider();
  }
}

export { CloudSpeechProvider } from './cloudSpeechProvider';
export { WebSpeechProvider } from './webSpeechProvider';
export { MockVoiceProvider } from './mockProvider';
export * from './types';
