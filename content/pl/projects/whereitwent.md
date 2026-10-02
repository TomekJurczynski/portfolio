---
id: "whereitwent"
name: "WhereItWent"
order: 3
url: "https://serene-chaja-a9b9e1.netlify.app/"
summary: "Offline'owy tracker wydatków z wpisem w 2 kliknięcia, budżetami kategorii, cyklicznymi transakcjami i celami."
stack:
  - "React 18"
  - "TypeScript"
  - "Vite"
  - "Dexie.js (IndexedDB)"
  - "Zustand"
  - "Tailwind CSS"
  - "Recharts"
role: "Jedyny deweloper — kierował agentem AI od pełnego blueprintu architektonicznego przez wdrożenie fazowe."
screenshots:
  - src: "/images/projects/whereitwent/dashboard.jpg"
    alt: "Dashboard WhereItWent z kwotą pozostałą do wydania, przyciskiem szybkiego dodania transakcji i ostatnimi transakcjami"
  - src: "/images/projects/whereitwent/budgets.jpg"
    alt: "Ekran budżetów WhereItWent z paskiem postępu kategorii i sugerowanymi limitami na podstawie wydatków z zeszłego okresu"
  - src: "/images/projects/whereitwent/statistics.jpg"
    alt: "Ekran statystyk WhereItWent z wykresem kołowym kategorii i saldem okresu"
---

## Problem

Szybkie, prywatne śledzenie wydatków bez integracji bankowych, kont w chmurze czy synchronizacji — tylko kwota + kategoria w dwa kliknięcia, z budżetami i celami, które uczciwie pokazują, ile naprawdę zostało do wydania.

## Decyzje

Między UI a Dexie/IndexedDB stoi ścisły wzorzec Repository, więc nowa funkcja (np. przyszły eksport do CSV) dodaje tylko metodę w repozytorium, nie dotykając komponentów. Wszystkie kwoty przechowywane są jako liczby całkowite (grosze), nigdy jako float, żeby uniknąć klasycznych błędów zaokrągleń w JavaScript. Cele oszczędnościowe nie są odrębnym, wirtualnym systemem: wpłata automatycznie tworzy powiązaną transakcję wydatku w zarezerwowanej kategorii "Oszczędności", dzięki czemu "ile zostało do wydania" na dashboardzie pozostaje wiarygodne; wypłata odwraca ten proces tak samo. Okresy budżetowe są konfigurowalne per profil (nie zawsze kalendarzowy miesiąc), a ta sama funkcja wyznaczająca granice okresu jest używana wszędzie — na dashboardzie, w budżetach i w statystykach miesiąc do miesiąca — więc liczby nigdy się ze sobą nie rozjeżdżają.

## Wyzwania

Zaległe transakcje cykliczne wymagały ostrożnej obsługi: jeśli aplikacja nie była otwierana przez miesiące, ciche wygenerowanie dziesiątek transakcji wstecz byłoby błędem, więc więcej niż jedno zaległe wystąpienie uruchamia jawny wybór per szablon (dodaj wszystkie / dodaj tylko najnowszą / pomiń i zapytaj następnym razem) zamiast cichego automatycznego uzupełnienia. Matematyka okresów budżetowych musiała też poprawnie docinać dni startu cyklu w krótszych miesiącach (np. dzień 31 w lutym), nie psując przy tym dashboardu, budżetów i statystyk zależnych od tych samych granic okresu.

## Wynik

Dostarczone fazowo zgodnie z pełnym blueprintem — podstawowy flow wpisywania transakcji, budżety z alertami progowymi, transakcje cykliczne, cele oszczędnościowe z ekranem ukończenia/celebracji, wyszukiwanie i statystyki, wielo-profilowość z kaskadowym usuwaniem oraz backup/restore JSON (globalny lub per profil).
