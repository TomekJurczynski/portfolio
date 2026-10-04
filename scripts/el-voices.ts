// Lists the ElevenLabs voices this API key can see, with their category, so a voice usable on
// the free plan (category "premade") can be told apart from a library voice, plus the plan tier
// when the key may read it. Run: pnpm el:voices (reads ELEVENLABS_API_KEY from .env, never prints it).
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY is not set in .env');
  process.exit(1);
}
const headers = { 'xi-api-key': apiKey };
const mine = [process.env.ELEVENLABS_VOICE_PL, process.env.ELEVENLABS_VOICE_EN];

type Voice = { voice_id: string; name: string; category?: string; labels?: Record<string, string> };

const sub = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers });
if (sub.ok) {
  const s = (await sub.json()) as { tier?: string; character_count?: number; character_limit?: number };
  console.log(`plan: ${s.tier ?? '?'}  characters used: ${s.character_count ?? '?'} / ${s.character_limit ?? '?'}\n`);
} else {
  console.log(`plan: (key cannot read subscription: http ${sub.status})\n`);
}

const res = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', { headers });
if (!res.ok) {
  console.error(`voices list failed: http ${res.status} (the key may lack the "voices read" permission)`);
  process.exit(1);
}
const { voices } = (await res.json()) as { voices: Voice[] };
for (const v of voices) {
  const lang = v.labels?.language ?? '';
  const flag = mine.includes(v.voice_id) ? '  <-- YOUR CONFIGURED VOICE' : '';
  console.log(`${(v.category ?? '?').padEnd(13)} ${v.voice_id}  ${v.name}${lang ? ` [${lang}]` : ''}${flag}`);
}

export {};
