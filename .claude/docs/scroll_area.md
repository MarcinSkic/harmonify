# ScrollArea — jak poprawnie używać

`ScrollArea` (reka-ui / shadcn-vue) wymaga, żeby jego root element miał ograniczoną wysokość. Dopiero wtedy `ScrollAreaViewport` (`size-full` = `height: 100%`) ma od czego się rozwinąć i scroll działa.

Poniżej dwa sprawdzone wzorce w zależności od kontekstu rodzica.

---

## Wzorzec 1: rodzic ma `max-height` (np. Dialog)

Używaj `max-h-full flex flex-col justify-start` na `ScrollArea`.

`max-height: 100%` rozwiązuje się względem `max-h` rodzica. Gdy zawartość przekroczy ten limit, `ScrollAreaRoot` dostaje ograniczoną wysokość i scroll się aktywuje.

```vue
<!-- DialogContent class="flex max-h-[85vh] flex-col" -->

<ScrollArea class="flex max-h-full flex-col justify-start rounded-lg border p-4">
  <div>...dużo zawartości...</div>
</ScrollArea>
```

**Nie działa:** samo `max-h-full` bez `flex flex-col` — `ScrollAreaViewport` (`height: 100%`) nie rozwiązuje się poprawnie bez flex kontekstu na rodzicu.

**Przykłady w projekcie:**
- `src/components/spotify/SpotifyLibraryDisplay.vue`
- `src/pages/library/components/ServerLibraryDisplay.vue`

---

## Wzorzec 2: rodzic ma określoną wysokość przez flex chain (np. fullscreen layout)

Używaj `flex-1 min-h-0` na `ScrollArea`. Cały łańcuch flex od elementu z jawną wysokością musi mieć `min-h-0`.

```
RootLayout:         h-screen
  RouterView:           grid row 1fr  (bounded)
    View:             h-full flex flex-col
      ScrollArea:   flex-1 min-h-0     ← scroll
        <content />
```

```vue
<!-- Widok: class="h-full flex flex-col" -->

<ScrollArea class="min-h-0 flex-1">
  <div>...zawartość...</div>
</ScrollArea>
```

**Dlaczego `min-h-0`:** domyślny `min-height: auto` na flex itemach zapobiega kurczeniu się poniżej rozmiaru zawartości — `overflow` nigdy nie triggeruje. `min-h-0` to usuwa.

**Przykład w projekcie:**
- `src/pages/local/round/components/CategoryPicker.vue` (grid kart kategorii)

---

## Wzorzec 3: rodzic to CSS Grid (nie flex), np. wielokolumnowy formularz

CSS Grid ma dokładnie ten sam domyślny `min-height: auto`/`min-width: auto` na elementach siatki co
flexbox na elementach flex — **`1fr` w `grid-template-rows`/`grid-template-columns` nie jest z tego
zwolnione.** Wiersz/kolumna `1fr` i tak nie skurczy się poniżej min-content zawartości elementu
siatki, więc kolumna z długą listą (np. siatka albumów) i tak urośnie do wysokości treści, mimo
`align-items: stretch` (domyślne) i mimo poprawnego `min-h-0 flex-1` na `ScrollArea` w środku.

Dwa miejsca do poprawienia naraz:

1. **Ślad `minmax(0, …)` w definicji toru siatki** zamiast gołego `1fr`:
   `grid-rows-[minmax(0,1fr)_50px]` zamiast `grid-rows-[1fr_50px]` (analogicznie dla
   `grid-template-columns`).
2. **`min-h-0` wprost na elemencie siatki** (bezpośrednim dziecku grida) — jeśli to komponent
   Vue z jednym korzeniem, wystarczy przekazać `class="min-h-0"` na tagu komponentu, Vue scali ją
   z klasami korzenia.

```vue
<!-- form: class="grid ... grid-rows-[minmax(0,1fr)_50px]" -->

<SomePanel class="min-h-0" />  <!-- korzeń SomePanel: h-full flex flex-col -->
```

Pominięcie punktu 2 (sam `minmax(0, …)` na torze) czasem nie wystarcza — element siatki wnosi
własny automatyczny rozmiar minimalny do algorytmu sizingu toru niezależnie od definicji toru, więc
oba kroki są potrzebne razem, tak jak `min-h-0` na przodku ORAZ na `ScrollArea` we wzorcu 2.

**Przykład w projekcie:** `src/pages/local/setup/LocalSetupView.vue` (`lg:` desktopowy layout —
3 kolumny grida, jedna z nich to siatka albumów/playlist wewnątrz `NavidromeGameSourcePicker.vue`).

---

## Kiedy nie używać ScrollArea

Gdy ScrollArea jest zbyt głęboko zagnieżdżone i łańcuch wysokości trudno przeprowadzić — użyj natywnego `overflow-y-auto` z `max-h-[Xvh]`. To pragmatyczne rozwiązanie dla rzadko używanych UI.

---

## Częste błędy

| Problem | Przyczyna | Fix |
|---|---|---|
| Scroll nie działa, zawartość wystaje | Brak `min-h-0` w łańcuchu flex | Dodaj `min-h-0` do `ScrollArea` i każdego flex przodka bez jawnej wysokości |
| `flex-1` nie pomaga | Rodzic ma tylko `max-height`, nie `height` | Użyj wzorca `max-h-full flex flex-col` zamiast `flex-1` |
| `p-4` na `ScrollArea` jest przycinane | `ScrollAreaRoot` ma `overflow-hidden` | Przenieś padding na element wewnątrz slotu |
