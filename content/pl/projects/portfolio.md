---
id: "portfolio"
name: "To portfolio — strona z przewodnikiem AI"
order: 0
layout: "featured"
summary: "Dwujęzyczne portfolio z agentem Claude opartym na faktach (tekst i głos), zbudowane od specyfikacji, z kierowaniem agentami AI."
stack:
  - "Astro 7"
  - "React 19"
  - "TypeScript"
  - "Netlify Functions"
  - "Claude API (Haiku 4.5)"
  - "Zod"
  - "Web Speech API"
  - "Playwright"
  - "axe-core"
  - "Vitest"
  - "Lighthouse CI"
role: "Jedyny twórca i właściciel produktu — napisał specyfikację, podjął każdą decyzję produktową i architektoniczną oraz kierował agentami AI przez budowę, testy i utwardzanie."
screenshots:
  - src: "/images/projects/portfolio/chat.jpg"
    alt: "Panel czatu portfolio: odwiedzający pyta o oczekiwania finansowe Tomasza, a agent uprzejmie odmawia i podsuwa przycisk e-mail"
    width: 840
    height: 1120
  - src: "/images/projects/portfolio/architecture.jpg"
    alt: "Schemat architektury: treści są kompilowane podczas budowy; przeglądarka rozmawia z zabezpieczoną funkcją Netlify, która woła Claude Haiku 4.5 i strumieniuje odpowiedź ze znacznikami sprawdzanymi względem białej listy"
    width: 1200
    height: 1838
---

## Problem

Zwykłe portfolio wymaga od zapracowanego rekrutera przeczytania wszystkiego, a większość tego nie robi. Celem była strona, na której rekruter z dwiema minutami na telefonie albo lider techniczny szukający dowodów może po prostu zapytać i dostać rzeczową odpowiedź opartą na faktach, i która sama pokazuje, jak pracuje jej właściciel. Ograniczenia były twarde: darmowy hosting, sztywny limit wydatków na API, brak przechowywania danych odwiedzających i agent, który nigdy nie może zmyślać faktów o prawdziwej osobie.

## Decyzje

Specyfikacja przed kodem: dokument wymagań i specyfikacja techniczna z identyfikatorami wymagań, kryteriami akceptacji i planem 20 zadań w pięciu kamieniach milowych powstały przed pierwszą linijką kodu, a agenci AI implementowali według nich. Agent odpowiada wyłącznie na podstawie wiedzy kompilowanej podczas budowy z plików treści walidowanych w Zod, mówi o Tomaszu w trzeciej osobie i zamiast zgadywać, mówi „nie mam takiej informacji". Strona jest statyczna: tylko czat jest wyspą JavaScriptu, więc całość działa nawet wtedy, gdy API jest niedostępne. Głos stoi za interfejsem dostawcy (dziś mowa przeglądarki, później lepszy lub realtime'owy dostawca) bez zmian w interfejsie, a pytanie wpisane dostaje odpowiedź tekstową, natomiast wypowiedziane jest czytane na głos.

## Bezpieczeństwo i koszty

Model nigdy nie pisze adresów URL. Wskazuje cele znacznikami linków i nawigacji, które klient mapuje na białą listę zbudowaną z treści, a klient pokazuje najwyżej dwie akcje na odpowiedź. Backend waliduje każde żądanie, usuwa znaki znaczników z historii przysłanej przez klienta, żeby sfałszowana wiadomość asystenta nie mogła podrzucić znacznika, wymusza listę dozwolonych źródeł i 20 żądań na godzinę z jednego adresu IP oraz loguje wyłącznie status, czas i długość, nigdy treść wiadomości. Rygorystyczna polityka Content-Security-Policy bez unsafe-inline jest generowana podczas budowy ze skrótów każdego skryptu i stylu inline. Koszt ogranicza Claude Haiku 4.5, cache'owany prompt systemowy, limit 400 tokenów odpowiedzi i historia 8 wiadomości; zamknięcie czatu przerywa zapytanie do modelu, więc żadne tokeny się nie marnują.

## Wyzwania

Strumieniowanie: pojedyncza porcja może przeciąć znacznik w połowie, więc parser buforuje niedokończony fragment, zamiast wyświetlać na ekranie surowy kod. Głos: anulowanie mowy w przeglądarce wywołuje to samo zdarzenie błędu co zakończone zdanie, przez co Stop przeskakiwał do następnego fragmentu; licznik generacji unieważnia teraz nieaktualne callbacki. Zdalne debugowanie: przycisk mikrofonu leżący o 7,6 px za nisko okazał się miejscem rezerwowanym pod textarea, które jest elementem inline-block, i znalazłem to wyłącznie z liczb computed style przesłanych z przeglądarki użytkownika. A testy na prawdziwym modelu znalazły rzeczy, których nie wychwycił żaden przegląd: agent wysłał kiedyś sześć znaczników akcji mimo limitu dwóch, zacytował fragment własnych zasad i wstawiał linki w środku zdania, które po zamianie znacznika na przycisk przestawało się czytać. Każdą z tych rzeczy naprawiłem we właściwej warstwie: w kliencie, w prompcie albo w teście.

## Bramki jakości

Ponad 40 testów jednostkowych; około 40 scenariuszy end-to-end na desktopie i w widoku mobilnym 390 px z zamockowanym strumieniem czatu, więc nic nie kosztują; audyty dostępności axe względem WCAG 2.2 AA w obu językach, obu motywach i z otwartym czatem, które wychwyciły i naprawiły u źródła zbyt niski kontrast tokenów; Lighthouse na poziomie 100 we wszystkich czterech kategoriach na desktopie, z LCP 0,6 s; budżety rozmiarów egzekwowane w CI; oraz zestaw 42 przypadków ewaluacyjnych, który przepuszcza prawdziwy model przez odmowy, pytania spoza bazy, języki, prośby o adresy URL i ataki prompt injection.

## Wynik

Szybka, dostępna, dwujęzyczna strona, której sercem jest agent trzymający się tematu, odmawiający tego, czego powinien, przyznający się do braku wiedzy i obsługiwany głosem. To zarazem najwyraźniejsza demonstracja sposobu pracy Tomasza: jest właścicielem wymagań, kompromisów i każdej decyzji produktowej, testuje na prawdziwych urządzeniach i kieruje agentami AI tak, by dostarczali wyniki klasy produkcyjnej. Następny na liście jest lepszy, neuronowy głos do czytania odpowiedzi.
