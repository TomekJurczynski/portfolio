---
id: "sprout"
name: "Sprout"
order: 2
url: "https://incredible-custard-b48857.netlify.app/"
summary: "Aplikacja PWA do budowania nawyków — jeden aktywny nawyk na raz, kolejny odblokowuje się dopiero po ustabilizowaniu."
stack:
  - "React 19"
  - "TypeScript"
  - "Vite"
  - "Dexie.js (IndexedDB)"
  - "Zustand"
  - "Chart.js"
role: "Jedyny deweloper — kierował agentem AI od specyfikacji architekta aż po przetestowaną, zainstalowaną aplikację."
screenshots:
  - src: "/images/projects/sprout/active-day.jpg"
    alt: "Ekran 'Dziś' w Sprout z aktywnym filarem 'Stałe pory snu' i listą mikro-kroków do odhaczenia"
  - src: "/images/projects/sprout/statistics.jpg"
    alt: "Ekran statystyk w Sprout z wykresem 10 tygodni i siatką dzień po dniu w stylu GitHuba dla jednego filaru"
  - src: "/images/projects/sprout/settings-dark.jpg"
    alt: "Ekran ustawień Sprout w trybie ciemnym z progiem utrwalenia i trybem zaawansowanym wielu filarów"
---

## Problem

Większość trackerów nawyków pozwala dodać wiele nawyków naraz, co jest też głównym powodem porzucania ich po pierwszym gorszym dniu — brakuje mechanizmu odróżniającego "jeden zły dzień" od "porzucenia nawyku".

## Decyzje

Sprout wymusza sekwencyjne budowanie nawyków: jeden "filar" (nawyk) jest aktywny na raz, a kolejny odblokowuje się dopiero po ustabilizowaniu poprzedniego — to świadome ograniczenie, nie brakująca funkcja. Próg „opanowania” (10 z 14 dni, ~71%) jest proporcjonalny i konfigurowalny per filar, a nie sztywną liczbą, więc dłuższe okno zachowuje tę samą proporcję sukcesu. Gdy w trakcie projektu właściciel uznał możliwość dalszej rozbudowy za twardy wymóg, architektura została świadomie przebudowana z minimalnego, czystego TypeScriptu na React + TypeScript z podziałem na moduły (feature-based) i Zustand — kosztem większego rozmiaru paczki, ale w zamian za dużo tańszy rozwój kolejnych funkcji. Sam silnik sekwencyjności napisany jest jako czyste, niezależne od frameworka funkcje, w pełni testowalne w izolacji.

## Wyzwania

Po pierwszej instalacji na telefonie wyszły dwa realne problemy, naprawione w jednym przebiegu prac: dolna nawigacja nie była przypięta do ekranu (błąd układu flex/overflow) oraz — co ważniejsze — właściciel zażądał twardej gwarancji, że aktualizacje appki nigdy nie skasują istniejących danych. Tę gwarancję zabezpiecza wersjonowanie schematu Dexie/IndexedDB z obowiązkowymi migracjami `.upgrade()` oraz dedykowany test automatyczny dowodzący, że stare dane przetrwają aktualizację schematu.

## Wynik

Przetestowane, zainstalowane MVP działające na realnym telefonie z Androidem, z 19 przechodzącymi testami automatycznymi (w tym testem bezpieczeństwa migracji danych), zero backendu, zero kont i zero telemetrii — dokładnie zgodnie ze specyfikacją.
