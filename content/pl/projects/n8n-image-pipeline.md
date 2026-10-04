---
id: "n8n-image-pipeline"
name: "Potok generowania obrazów AI (n8n)"
order: 5
layout: "workflow"
summary: "Potok n8n uruchamiany jednym kliknięciem: trzy połączone agenty AI zamieniają temat w gotowe grafiki z opisem."
stack:
  - "n8n"
  - "OpenAI GPT-4.1"
  - "gpt-image-1"
  - "Structured Output Parsers"
  - "Imgur API"
  - "Google Sheets"
role: "Jedyny twórca — zaprojektował łańcuch agentów, prompty i przepływ danych, a potem wykorzystał potok jako szablon do innych zastosowań."
screenshots:
  - src: "/images/projects/n8n-image-pipeline/workflow.jpg"
    alt: "Płótno n8n z dwoma etapami: generowanie promptów (agenty Style, Character i Final z parserami wyjścia) oraz budowa i zapis (węzły kodu, generowania obrazu, konwersji, wysyłki i Google Sheets)"
    width: 1129
    height: 673
---

## Problem

Stały dopływ zróżnicowanych wizualnie grafik AI oznacza ręczne powtarzanie tej samej pracy twórczej: wybór stylu, wybór bohaterów, napisanie długiego, starannego promptu, wygenerowanie obrazu, umieszczenie pliku w sieci i zapisanie, co i jak powstało. Celem był workflow, który robi to wszystko jednym kliknięciem i dostarcza obrazy do użytku osobistego, np. na plakaty i posty w mediach społecznościowych.

## Decyzje

Pracę twórczą podzieliłem między trzy wąsko wyspecjalizowane agenty GPT-4.1 zamiast jednego ogromnego prompta. Style Agent wybiera jeden z około 50 kierunków artystycznych (albo wymyśla nowy) i pisze tytuł oraz krótki opis z hashtagami. Character Agent wybiera trzy znane postacie z listy 75 gier i zwraca wyłącznie ich ubiór i paletę kolorów. Final Agent łączy jedno z drugim w trzy filmowe prompty do generatora obrazów. Każdy agent zwraca JSON weryfikowany przez Structured Output Parser, więc każdy etap przekazuje następnemu przewidywalny kontrakt. Wszystko jest zapisywane, dzięki czemu każdy obraz można prześledzić do promptu, który go wytworzył.

## Wyzwania

Modele językowe słabo radzą sobie z losowaniem liczb, więc polecenie „wybierz losowo grę" zamieniłem na jawną procedurę: pomyśl liczbę od 1 do 75 i znajdź ją na liście. Daje to dużą różnorodność, ale to tylko pseudolosowość, a ściślejszym rozwiązaniem byłby węzeł z kodem. Jakość promptów wymagała konkretnych reguł: wczesne prompty z abstrakcyjnymi określeniami rozmiaru, jak „dziesięć procent skali", dawały niewyraźne, mało szczegółowe obrazy, więc agent musi teraz opisywać kadr językiem wizualnym i wspominać o rozdzielczości w treści prompta, z jedną postacią na prompt. Dane musiały też przetrwać przejście przez kilka systemów: znaki nowej linii są usuwane, zanim prompt trafi do żądania JSON, a obraz zwrócony przez API w Base64 jest zamieniany na plik przed wysłaniem w celu uzyskania publicznego linku.

## Wynik

Działający potok uruchamiany ręcznie, gdy potrzebne są obrazy: generuje trzy obrazy w formacie pionowym oraz tytuł, opis, linki i prompty źródłowe w jednym wierszu arkusza. Potem stał się szablonem do ponownego użycia: skopiowałem go i dostosowałem do portretów postaci z League of Legends w jednym stałym stylu, do tapet z krajobrazami z gier w różnych stylach oraz do bardziej praktycznych zastosowań, jak okładki książek, notatników i zeszytów czy spersonalizowane plakaty urodzinowe dla znajomych. To samo podejście rozszerzyłem na osobne workflowy n8n do automatyzacji poczty. Obrazy służą do użytku osobistego, a postacie należą do ich wydawców.
