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

## Kiedy nie używać ScrollArea

Gdy ScrollArea jest zbyt głęboko zagnieżdżone i łańcuch wysokości trudno przeprowadzić — użyj natywnego `overflow-y-auto` z `max-h-[Xvh]`. To pragmatyczne rozwiązanie dla rzadko używanych UI.

---

## Częste błędy

| Problem | Przyczyna | Fix |
|---|---|---|
| Scroll nie działa, zawartość wystaje | Brak `min-h-0` w łańcuchu flex | Dodaj `min-h-0` do `ScrollArea` i każdego flex przodka bez jawnej wysokości |
| `flex-1` nie pomaga | Rodzic ma tylko `max-height`, nie `height` | Użyj wzorca `max-h-full flex flex-col` zamiast `flex-1` |
| `p-4` na `ScrollArea` jest przycinane | `ScrollAreaRoot` ma `overflow-hidden` | Przenieś padding na element wewnątrz slotu |
