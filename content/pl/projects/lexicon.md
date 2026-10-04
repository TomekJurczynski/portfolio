---
id: "lexicon"
name: "Lexicon"
order: 1
url: "https://nimble-dango-6f473b.netlify.app/"
summary: "Aplikacja PWA działająca offline do codziennej nauki słownictwa z powtórkami, seriami dni per język i wymową."
stack:
  - "Vanilla JavaScript"
  - "HTML5 / CSS3"
  - "Progressive Web App"
  - "Web Speech API"
  - "localStorage"
role: "Jedyny deweloper — kierował agentem AI przez cztery duże wersje (obecnie 4.0) na podstawie realnego, codziennego użytkowania."
screenshots:
  - src: "/images/projects/lexicon/main-screen.jpg"
    alt: "Ekran wyboru języka w Lexiconie — angielski, włoski i norweski ze streakami per język"
  - src: "/images/projects/lexicon/lesson-dashboard.jpg"
    alt: "Panel poziomu angielski B2 w Lexiconie z liczbą opanowanych/w nauce słówek i przyciskiem rozpoczęcia lekcji"
  - src: "/images/projects/lexicon/flashcard.jpg"
    alt: "Fiszka słowa 'Approach' w Lexiconie z wymową, tłumaczeniem, definicją i przykładowym zdaniem"
---

## Problem

Typowe aplikacje do nauki języków skupiają się na gramatyce lub konwersacji. Brakowało narzędzia wymuszającego regularną, codzienną naukę zaawansowanego słownictwa — za darmo i bez tarcia przy starcie, instalowalnego od razu z przeglądarki.

## Decyzje

Aplikacja powstała jako instalowalna Progressive Web App zamiast natywnej aplikacji, bez żadnego backendu — wszystko żyje w `localStorage`, co utrzymuje projekt darmowym, prywatnym i w pełni offline. Powtórki słówek wykorzystują pudełkowy system Leitnera (6 pudełek), a serie dni (streaki) liczone są osobno dla każdego języka, nie globalnie ani per poziom CEFR — świadomy kompromis między motywacją a nadmierną fragmentacją. Wymowa korzysta z wbudowanego w przeglądarkę Web Speech API zamiast płatnego API TTS w chmurze, kosztem słabszej jakości głosu, ale bez kosztów i z pełnym działaniem offline.

## Wyzwania

Każda aktualizacja musi zachować postęp użytkownika: nazwy kluczy w `localStorage` traktowane są jako stały kontrakt danych, a wersja cache service workera jest inkrementowana przy każdym wydaniu, żeby użytkownik nie dostał nieaktualnych plików. Nowe paczki słówek generowane są jako JSON i sprawdzane krzyżowo względem wszystkich istniejących paczek tego samego języka, żeby uniknąć duplikatów na tym samym poziomie.

## Wynik

Działająca aplikacja używana codziennie przez właściciela — obecnie wersja 4.0, obsługująca dowolny język, który użytkownik doda (na zrzutach ekranu skonfigurowane są angielski, włoski i norweski) na wszystkich 5 poziomach CEFR, z ponad 1200 słówkami w zaimportowanych paczkach, przełącznikiem kierunku nauki (obcy → ojczysty lub odwrotnie) i odtwarzaniem wymowy dla każdej fiszki.
