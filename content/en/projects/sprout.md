---
id: "sprout"
name: "Sprout"
order: 2
url: "https://incredible-custard-b48857.netlify.app/"
summary: "Habit-building PWA that enforces one active habit at a time, unlocking the next only once the last one sticks."
stack:
  - "React 19"
  - "TypeScript"
  - "Vite"
  - "Dexie.js (IndexedDB)"
  - "Zustand"
  - "Chart.js"
role: "Sole developer, directing an AI coding agent from an architect's spec through to a tested, installed app."
screenshots:
  - src: "/images/projects/sprout/active-day.jpg"
    alt: "Sprout 'Today' screen showing the active pillar 'Consistent sleep schedule' with its micro-step checklist"
  - src: "/images/projects/sprout/statistics.jpg"
    alt: "Sprout statistics screen with a 10-week completion chart and a GitHub-style daily heatmap for one pillar"
  - src: "/images/projects/sprout/settings-dark.jpg"
    alt: "Sprout settings screen in dark mode showing the stabilization threshold and advanced multi-pillar mode"
---

## Problem

Most habit trackers let people add many habits at once, which is also the main reason people abandon them after the first bad day — there's no structure that tells "one off day" apart from "giving up".

## Decisions

Sprout enforces sequential habit-building: one "pillar" (habit) is active at a time, and the next unlocks only after the current one stabilizes — a deliberate constraint, not a missing feature. The "mastered" threshold (10 of 14 days, ~71%) is proportional and configurable per pillar rather than a fixed number, so a longer-window habit scales the same success ratio. When the owner made long-term extensibility an explicit, non-negotiable requirement mid-project, the architecture was deliberately upgraded from a minimal vanilla-TypeScript build to React + TypeScript with a feature-based folder structure and Zustand — accepting a larger bundle in exchange for much cheaper future feature work. The sequencing engine itself is written as pure, framework-free functions, fully unit-testable in isolation.

## Challenges

After the first real-world install on a phone, two issues surfaced and were fixed in the same pass: the bottom navigation wasn't pinned to the screen (a flex/overflow layout bug), and — more critically — the owner required a hard guarantee that app updates would never wipe existing habit data. That guarantee is backed by Dexie/IndexedDB schema versioning with mandatory `.upgrade()` migrations and a dedicated automated test that proves old data survives a schema upgrade.

## Outcome

A tested, installed MVP running on a real Android phone, with 19 passing automated tests including the data-migration safety test, zero backend, zero accounts, and zero telemetry — exactly as specified.
