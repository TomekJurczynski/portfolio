---
id: "lexicon"
name: "Lexicon"
order: 1
url: "https://nimble-dango-6f473b.netlify.app/"
summary: "Offline PWA for daily vocabulary practice with spaced repetition, per-language streaks and built-in pronunciation."
stack:
  - "Vanilla JavaScript"
  - "HTML5 / CSS3"
  - "Progressive Web App"
  - "Web Speech API"
  - "localStorage"
role: "Sole developer, directing an AI coding agent through 6 iterative versions driven by real daily use."
screenshots:
  - src: "/images/projects/lexicon/main-screen.jpg"
    alt: "Lexicon language selection screen showing English, Italian and Norwegian with per-language streaks"
  - src: "/images/projects/lexicon/lesson-dashboard.jpg"
    alt: "Lexicon level dashboard for English B2 showing mastered/learning word counts and the Start lesson button"
  - src: "/images/projects/lexicon/flashcard.jpg"
    alt: "Lexicon flashcard for the word 'Approach' with pronunciation, translation, definition and example sentence"
---

## Problem

Generic vocabulary apps optimize for grammar or conversation; what was missing was a tool that enforces regular, daily practice of advanced vocabulary with zero cost and zero setup friction — installable straight from the browser, no app store.

## Decisions

Built as an installable Progressive Web App instead of a native app, with no backend at all — everything lives in `localStorage`, keeping the project free, private and fully offline. Vocabulary review uses a 6-box Leitner spaced-repetition system, and streaks are tracked per language rather than globally or per CEFR level — a deliberate middle ground between motivation and over-fragmentation. Pronunciation uses the browser's built-in Web Speech API instead of a paid cloud TTS service, trading voice quality for zero cost and full offline support.

## Challenges

Every update has to preserve the user's existing progress: `localStorage` key names are treated as a stable data contract, and the service worker cache version is bumped on every release so users don't get served stale files. New vocabulary packs are generated as JSON and cross-checked against every existing pack in the same language to avoid duplicate words slipping into the same level.

## Outcome

A working app used daily by its owner — now on version 4, supporting multiple languages (English, Italian, plus user-added custom languages) across all 5 CEFR levels, with over 1,200 words across imported packs, direction switching (foreign → native or native → foreign), and audio playback for every card.
