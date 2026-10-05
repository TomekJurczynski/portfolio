---
id: "portfolio"
name: "This portfolio — a site with an AI guide"
order: 0
layout: "featured"
summary: "A bilingual portfolio with a grounded Claude agent (text and voice), built spec-first by directing AI coding agents."
stack:
  - "Astro 7"
  - "React 19"
  - "TypeScript"
  - "Netlify Functions"
  - "Claude API (Haiku 4.5)"
  - "Zod"
  - "Web Speech API"
  - "ElevenLabs TTS"
  - "Playwright"
  - "axe-core"
  - "Vitest"
  - "Lighthouse CI"
role: "Sole builder and product owner — wrote the spec, made every product and architecture call, and directed AI coding agents through build, testing and hardening."
screenshots:
  - src: "/images/projects/portfolio/chat.jpg"
    alt: "The portfolio's chat panel: the visitor asks what salary Tomasz expects, and the agent politely declines and offers an Email button"
    width: 840
    height: 1120
  - src: "/images/projects/portfolio/architecture.jpg"
    alt: "Architecture diagram: content is compiled at build time; the browser talks to a guarded Netlify Function, which calls Claude Haiku 4.5 and streams the reply back with markers that the client checks against a whitelist"
    width: 1200
    height: 1838
---

## Problem

A portfolio usually asks a busy recruiter to read everything, and most do not. The goal was a site where a recruiter with two minutes on a phone, or a tech lead who wants proof, can simply ask and get a straight, grounded answer, and where the site itself shows how its owner works. The constraints were strict: free hosting, a hard cap on API spend, no stored visitor data, and an agent that must never invent facts about a real person.

## Decisions

Specification first: a requirements document and a technical spec with requirement IDs, acceptance criteria and a 20-task plan across five milestones were written before any code, and AI coding agents implemented against them. The agent answers only from knowledge compiled at build time from content files validated with Zod, speaks about Tomasz in the third person, and says "I don't have that" instead of guessing. The site is static-first: only the chat is a JavaScript island, so the page works even if the API is down. Voice sits behind a provider interface: the microphone uses the browser's speech recognition, while replies are read aloud by ElevenLabs through a guarded Netlify Function, so the vendor key never reaches the browser. If the cloud voice fails for any reason, the browser voice reads the same text, so a reply is never silently lost. The vendor was chosen by ear: Google's Chirp 3 HD read English words inside Polish sentences with Polish letter sounds, and ElevenLabs handled both languages clearly better. A typed question gets a text reply with an on-demand speaker button, while a spoken one is read aloud.

## Safety and cost

The model never writes a URL. It points with link and navigation markers that the client maps to a whitelist built from the content, and the client shows at most two actions per answer. The backend validates every request, strips marker characters from client-sent history so a forged assistant turn cannot plant one, enforces an origin allow-list and per-IP rate limits (20 chat requests and 120 voice requests per hour), and logs only status, timing and length, never message content. A strict Content-Security-Policy without unsafe-inline is generated at build time from hashes of every inline script and style. Cost is bounded by Claude Haiku 4.5, a cached system prompt, a 400-token reply cap and an 8-message history; closing the chat aborts the upstream request so no tokens are wasted.

## Challenges

Streaming: a single chunk can cut a marker in half, so the parser buffers an unfinished fragment instead of flashing raw markup on screen. Voice: cancelling browser speech fires the same error event as a finished sentence, which made Stop skip to the next chunk; a generation counter now invalidates stale callbacks. Remote debugging: a mic button sitting 7.6 px too low turned out to be a textarea's inline-block descender space, found purely from computed-style numbers reported from the user's browser. And the real-model tests found issues no review had: the agent once sent six action markers despite a limit of two, quoted a fragment of its own rules, and wrote links mid-sentence so the sentence broke when the button replaced the marker. Each was fixed in the right layer, in the client, in the prompt, or in the test.

## Quality gates

Over 60 unit tests; about 50 end-to-end scenarios on desktop and a 390 px mobile viewport, with the chat stream mocked so they cost nothing; accessibility audits with axe against WCAG 2.2 AA in both languages, both themes and with the chat open, which caught and fixed low-contrast tokens at their source; Lighthouse at 100 in all four categories on desktop, with an LCP of 0.6 s; size budgets enforced in CI; and a 57-case evaluation suite that runs the real model through refusals, out-of-knowledge questions, languages, URL requests and prompt-injection attacks.

## Outcome

A fast, accessible, bilingual site whose centrepiece is an agent that stays on topic, refuses what it should, admits what it does not know, and can be steered by voice. It is also the clearest demonstration of the way Tomasz works: he owns the requirements, the trade-offs and every product decision, tests on real devices, and directs AI coding agents to deliver production-grade results.
