// A/B for naturalness and latency: Chirp 3 HD vs Gemini-TTS (same API, same key), same realistic
// agent reply, Leda and Charon. Run: pnpm tts:compare — output in tmp-tts-samples/cmp-*.mp3,
// timings printed. The API key is never printed.
import { mkdir, writeFile } from 'node:fs/promises';
import { synthesizeSpeech } from '../netlify/functions/lib/tts.ts';

const apiKey = process.env.GOOGLE_TTS_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_TTS_API_KEY is not set in .env');
  process.exit(1);
}

const TEXT = {
  'pl-PL':
    'Tomasz pracuje w Consdata jako deweloper low-code na platformie Eximee. W wolnym czasie buduje własne aplikacje, a całą implementację prowadzi, kierując agentami AI. Najbardziej dumny jest z tego asystenta, który odpowiada tutaj głosem. Chcesz wiedzieć więcej o którymś z projektów?',
  'en-US':
    "Tomasz works at Consdata as a low-code developer on the Eximee platform. In his free time he builds his own apps, directing AI agents through the whole implementation. He is proudest of this assistant, which answers right here by voice. Would you like to know more about any of the projects?",
} as const;
const STYLE = {
  'pl-PL': 'Mów po polsku naturalnie, ciepło i rozmownie, jak życzliwy kolega z pracy opowiadający o znajomym. Spokojne tempo, żywa intonacja.',
  'en-US': 'Speak naturally, warmly and conversationally, like a friendly colleague talking about a friend. Relaxed pace, lively intonation.',
} as const;

const VARIANTS = [
  { tag: 'chirp3', model: undefined, prompt: false },
  { tag: 'gemini25flash', model: 'gemini-2.5-flash-tts', prompt: true },
  { tag: 'gemini25pro', model: 'gemini-2.5-pro-tts', prompt: true },
] as const;
const VOICES = ['Leda', 'Charon'];

await mkdir('tmp-tts-samples', { recursive: true });
for (const lang of ['pl-PL', 'en-US'] as const) {
  for (const voice of VOICES) {
    for (const v of VARIANTS) {
      const label = `${lang}-${voice}-${v.tag}`;
      const t0 = Date.now();
      try {
        const audio = await synthesizeSpeech({
          text: TEXT[lang],
          lang,
          voiceName: v.model ? voice : `${lang}-Chirp3-HD-${voice}`,
          modelName: v.model,
          prompt: v.prompt ? STYLE[lang] : undefined,
          apiKey,
        });
        await writeFile(`tmp-tts-samples/cmp-${label}.mp3`, audio);
        console.log(`ok   ${label}.mp3  ${((Date.now() - t0) / 1000).toFixed(1)} s  ${Math.round(audio.length / 1024)} KB`);
      } catch (err) {
        console.log(`FAIL ${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
