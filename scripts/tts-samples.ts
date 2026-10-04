// Generates the same EN and PL sentence with several Chirp 3 HD voices so the voice can be
// chosen by ear. Run: pnpm tts:samples  (reads GOOGLE_TTS_API_KEY from .env, never prints it).
// Output: tmp-tts-samples/<lang>-<voice>.mp3 — open them in any player.
import { mkdir, writeFile } from 'node:fs/promises';
import { synthesizeSpeech } from '../netlify/functions/lib/tts.ts';

const apiKey = process.env.GOOGLE_TTS_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_TTS_API_KEY is not set in .env');
  process.exit(1);
}

const VOICES = ['Aoede', 'Kore', 'Leda', 'Zephyr', 'Puck', 'Charon', 'Fenrir', 'Orus'];
const TEXT = {
  'en-US':
    "Hi, I'm Tomasz's assistant. I can tell you about his three apps, his work at Consdata, and what he is looking for next. What would you like to know?",
  'pl-PL':
    'Cześć, jestem asystentem Tomasza. Opowiem Ci o jego trzech aplikacjach, pracy w Consdata i o tym, czego szuka w kolejnym kroku. Co Cię interesuje?',
} as const;

await mkdir('tmp-tts-samples', { recursive: true });
for (const lang of ['pl-PL', 'en-US'] as const) {
  for (const voice of VOICES) {
    try {
      const audio = await synthesizeSpeech({
        text: TEXT[lang],
        lang,
        voiceName: `${lang}-Chirp3-HD-${voice}`,
        apiKey,
      });
      await writeFile(`tmp-tts-samples/${lang}-${voice}.mp3`, audio);
      console.log(`ok   ${lang}-${voice}.mp3`);
    } catch (err) {
      console.log(`FAIL ${lang}-${voice}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
