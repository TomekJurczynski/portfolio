# Portfolio — Tomasz Jurczyński

Personal portfolio site (English default, Polish under `/pl/`). The centrepiece is an **AI chat
agent** that answers questions about Tomasz, grounded only in the site's own content, with optional
voice input and read-aloud.

Live site: <https://tomasz-jurczynski-portfolio.netlify.app>

## Stack

- **Astro 7** (static output) + one **React 19** island for the chat widget
- **TypeScript** (strict), **Zod** for content validation
- **Netlify Functions**: `/api/chat` (Claude via `@anthropic-ai/sdk`, streamed NDJSON) and `/api/speak`
  (cloud text-to-speech proxy)
- **Vitest** (unit), **Playwright** + axe (E2E and accessibility), Lighthouse CI, a real-model agent eval

## How it fits together

```
content/ (Markdown + JSON, EN + PL)
   │  pnpm run knowledge   (validated by src/content/schema.ts)
   ├─► netlify/functions/lib/*.generated.ts   system prompt + knowledge for the agent
   └─► src/chat/actions.generated.ts          whitelist of ids the UI may act on
```

- **The agent only knows `content/`.** The system prompt (`content/agent/system-prompt.md`) tells it to
  answer from the knowledge block, say so when something is missing and point to the contact link.
  Salary, phone/address and opinions about employers are off-limits by design.
- **Action markers.** The model never writes URLs. It writes `{{link:<id>}}` / `{{nav:<id>}}` and the
  client maps whitelisted ids to real links or scroll targets, so it cannot invent a destination.
- **Voice.** Mic input uses the browser's Web Speech API. Read-aloud uses the browser voice or, when
  `PUBLIC_VOICE_PROVIDER=cloud`, `/api/speak` (ElevenLabs or Google Chirp 3 HD), falling back to the
  browser voice on any failure.
- **Security.** Hash-based CSP generated at build time (`scripts/build-csp.mjs`), origin allow-list and
  rate limits on both functions, client-sent history stripped of marker syntax, no message content
  in logs.

## Getting started

Requires Node 22 and pnpm (`npm install -g pnpm`).

```bash
pnpm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY (and optionally TTS keys)
pnpm dev                    # netlify dev on http://localhost:8888
```

Use `pnpm dev`, not `pnpm run dev:astro-only`: only the former serves `/api/chat` and `/api/speak`.
Generated files are gitignored — `pnpm dev` and `pnpm run build:all` regenerate them.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local dev with functions, port 8888 |
| `pnpm run build:all` | Knowledge + palettes + Astro build + CSP headers |
| `pnpm run typecheck` / `lint` / `test` | Static checks and unit tests |
| `pnpm run test:e2e` | Builds, then runs Playwright (desktop + mobile, a11y, CSP); `/api/chat` is mocked |
| `pnpm run budgets` | Performance budgets on the built output |
| `pnpm run lighthouse` | Lighthouse CI (desktop preset) |
| `pnpm eval [set ...]` | Agent evals against the **real model** (costs API money, never in CI) |
| `pnpm run images` | Regenerate responsive WebP variants of project screenshots |

Playwright serves the production build on port 4321 and will silently reuse a dev server already
running there — set `E2E_PORT` to a free port to avoid that. Voice tests run only on a cloud build:
`PUBLIC_VOICE_PROVIDER=cloud pnpm run build:all`, then `E2E_CLOUD_VOICE=1 pnpm exec playwright test`.

## Environment variables

See `.env.example` for the full list. Secrets are set in the Netlify dashboard, never committed.

| Variable | Where | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | function | Claude API key |
| `MODEL_ID`, `MAX_OUTPUT_TOKENS` | function | Model and reply cap (defaults in `.env.example`) |
| `CHAT_ENABLED` | function | `false` switches the agent off (UI shows the fallback) |
| `ALLOWED_ORIGINS` | function | Extra allowed origins (supports one-label wildcards) |
| `PUBLIC_SITE_URL` | build | Canonical URL for sitemap, robots, Open Graph |
| `PUBLIC_VOICE_PROVIDER` | build | `web-speech` (default) or `cloud` |
| `TTS_PROVIDER`, `ELEVENLABS_*`, `GOOGLE_TTS_API_KEY`, `TTS_ENABLED` | function | Cloud voice vendor and kill switch |
| `PUBLIC_PALETTE_SWITCHER` | build | Dev-only comparison of non-default palettes; keep unset in production |

## Editing content

Everything the site and the agent say lives in `content/` (`en/`, `pl/`, `agent/`, `site.json`).
After editing, run `pnpm run knowledge` (done automatically by `pnpm dev` / `build:all`). The build
fails on schema errors. `content/en/faq.md` is agent-only and is not rendered on the site.

## Testing the agent

`tests/eval/*.json` hold the cases (refusals, out-of-knowledge, language, URLs, prompt injection,
facts). `pnpm eval` runs them through the same prompt and parameters as `/api/chat`, applies automatic
assertions and writes full replies to `tests/eval/results/` (gitignored). Assertions cannot catch a
plausible-sounding invented fact, so read those replies by hand before a release.

## Deployment

Netlify, continuous deployment from `main` (free plan, so builds are kept deliberate). Work happens
on feature branches; branch deploys are limited to the production branch. Build command is
`pnpm run build:all`, publish directory `dist`.

## Known gaps

Not tested on Safari (macOS/iOS) or Chrome on Android. Firefox has no speech recognition, so the mic
button is hidden there; text chat and read-aloud still work.
