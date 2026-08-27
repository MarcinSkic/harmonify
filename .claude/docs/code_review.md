# Code Review Conventions

Project-specific calibration for reviewing this codebase. Companion to
[architectural_patterns.md](architectural_patterns.md) — that file explains the architecture
(schema homes, Dexie + `useLiveQuery`, service namespaces, store organization, the local-game
engine, and the **Known debt** list); this file only covers what a reviewer needs on top of it.

Do not restate the architecture here. If a rule is about *what the code should look like*, it
belongs in `architectural_patterns.md`; this file is about *how to judge a change*.

## Automated checks — run them, do not eyeball them

```bash
pnpm lint          # eslint .
pnpm type-check    # vue-tsc --build --force
pnpm vitest run    # unit tests, single run
```

Scope the linter to a subtree with `pnpm exec eslint src/pages/library`.

The config (`eslint.config.js`) is `@antfu/eslint-config` (`typescript` + `vue` + `formatters`)
plus `eslint-plugin-better-tailwindcss`. That already enforces formatting, quote style, import
ordering, and Tailwind class wrapping — `better-tailwindcss/no-unknown-classes` is deliberately
off. Never file a review finding the linter would have caught; report its actual output instead.

## Size calibration — measure the `<script setup>` block, not the file

Across the healthy slices (`src/components/ui/` and `src/pages/local/` excluded), script blocks
run roughly **~27 lines at the median, ~44 at p75, ~78 at p90**. Past **~100 lines of script**,
look for an extraction — that is a trigger to investigate, not a finding on its own.

Total file length is a poor signal: `src/pages/local/setup/components/LocalGameSettingsForm.vue`
is 334 lines with a 23-line script, and a long template of straight-line form markup is fine.
Real template smells are two or three near-identical blocks that want a `v-for` or a shared
subcomponent, and nesting deep enough to hide the structure.

These numbers describe where the codebase is, not where it has to stay.

## Where extracted code goes

| Extract to | When |
| --- | --- |
| a co-located `*.ts` next to the component | pure helpers for that one component — the `wheel.ts` / `TeamWheel.vue` pair in `src/pages/local/round/components/` |
| `src/pages/local/engine/` | local-game rules (pure, state-in/state-out, unit-tested) |
| `src/composables/` | reactive logic reused across slices |
| `src/lib/` | pure utilities reused across slices |
| a service in `src/services/` | anything doing I/O — Dexie writes, `fetch` |
| a subcomponent + `index.ts` barrel | a self-contained template chunk with its own state — see `src/pages/game/components/player/`, `trackDisplay/`, `playerResult/` |

## Error handling and feedback

- A **user-initiated** async action that can fail must surface the failure. `toast.error(...)`
  from `vue-sonner` is the established mechanism (most `catch` blocks in the repo do this).
  A silent `catch`, or one that only writes to `console`, is a finding for user-initiated work.
- `console.error` alone is fine for internal/background failures where a toast would be noise —
  audio load and volume in `PreviewPlayer.vue` / `musicPlayer.ts`, background library loads in
  `useLoadServerLibrary.ts`.
- A view that fetches should have both a loading and an empty state. `serverLibrary`'s
  `isLoading` / `loadError` is the pattern to copy.

## Naming

- Names say *what*, not *how*: `computeResult`, `pickFromCategory`, `isExhausted`,
  `addTracksDeduplicating` are the register to match. Flag `data`, `handle`, `tmp`, `doStuff`,
  and booleans that are not `is*` / `has*` / `should*`.
- The `_` prefix is **not** a naming smell: it marks the low-level contract methods on
  `MusicPlayer` (`_play`, `_seek`) and private helpers inside `localGame.ts` (`_persist`,
  `_loadTrack`). Leave both alone.

## Magic values — narrow scope

- Recurring animation/delay timings belong in the `AnimationDuration` enum in `src/consts.ts`
  (see `GameResults.vue`, `ResultView.vue`). A one-off delay with a comment explaining it is
  fine — e.g. the 150 ms blur delay in `TagMultiSelect.vue`.
- Responsive pixel values belong in the `Breakpoint` enum; localStorage keys in the
  `LOCAL_STORAGE` object. Inline literals for either are a finding.

## Comments

The repo comments the *why* of non-obvious geometry or protocol (see the header of `wheel.ts`).
Flag comments that restate the code, and commented-out code. Do not ask for docblocks on
self-evident functions.

## Review exclusions

- `src/components/ui/` is **generated** shadcn-vue code following shadcn's conventions, not this
  project's. Never file style findings against it — only flag a file there that was hand-modified
  in the diff under review.
- Do not flag `dist/`, `node_modules/`, `.claude/`, or lockfiles.
- The **Known debt** section of `architectural_patterns.md` lists standing violations that are
  already tracked. Do not re-report them on an unrelated diff, and do not cite `src/pages/local/`
  as precedent for anything while it is being paid down. The `engine/` split is the exception —
  it is the target shape.
