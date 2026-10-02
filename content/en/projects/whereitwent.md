---
id: "whereitwent"
name: "WhereItWent"
order: 3
url: "https://serene-chaja-a9b9e1.netlify.app/"
summary: "Offline expense tracker with 2-tap entry, category budgets, recurring transactions and savings goals."
stack:
  - "React 18"
  - "TypeScript"
  - "Vite"
  - "Dexie.js (IndexedDB)"
  - "Zustand"
  - "Tailwind CSS"
  - "Recharts"
role: "Sole developer, directing an AI coding agent from a full architectural blueprint through phased delivery."
screenshots:
  - src: "/images/projects/whereitwent/dashboard.jpg"
    alt: "WhereItWent dashboard showing the amount left to spend, a quick 'Add transaction' button and recent transactions"
  - src: "/images/projects/whereitwent/budgets.jpg"
    alt: "WhereItWent budgets screen with a category progress bar and suggested budget limits based on last period's spending"
  - src: "/images/projects/whereitwent/statistics.jpg"
    alt: "WhereItWent statistics screen with a category donut chart and period balance"
---

## Problem

Fast, private expense tracking without bank integrations, cloud accounts or sync — just amount + category in two taps, with budgets and goals that stay honest about what's actually left to spend.

## Decisions

A strict Repository pattern sits between the UI and Dexie/IndexedDB, so new features (e.g. a future CSV export) only ever add a repository method rather than touching components. All money is stored as integer cents (grosze), never floats, to avoid classic JavaScript rounding bugs. Savings goals are not a side system: a deposit automatically creates a linked expense transaction in a reserved "Savings" category, so the dashboard's "left to spend" figure stays accurate; a withdrawal reverses it the same way. Budget periods are configurable per profile (not always the calendar month) and the same period-boundary function is reused everywhere — dashboard, budgets, and month-to-month statistics — so the numbers never disagree with each other.

## Challenges

Recurring-transaction backlogs needed careful handling: if the app wasn't opened for months, silently generating dozens of backdated transactions would be wrong, so more than one missed occurrence triggers an explicit per-template choice (generate all / generate latest only / skip and ask again next time) instead of a silent auto-fill. Budget-period math also had to clamp cycle start days across shorter months (e.g. day 31 in February) without breaking the dashboard, budgets and statistics views that all depend on the same period boundaries.

## Outcome

Delivered phase by phase against the full blueprint — core entry flow, budgets with threshold alerts, recurring transactions, savings goals with a completion/celebration flow, search and statistics, multi-profile support with cascading deletion, and JSON backup/restore (global or per-profile).
