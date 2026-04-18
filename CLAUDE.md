# CLAUDE.md

## Project Overview

Harmonify is a multiplayer "Name that tune" game. Players join a room, listen to Spotify track previews, and race to guess the track/artist/album. Points are awarded by speed and accuracy. Also includes a standalone Cover Creator for generating playlist cover art.

## Tech Stack

Vue 3 (Composition API, `<script setup>`) + TypeScript + Pinia + Vue Router + TailwindCSS + Zod
UI: shadcn-vue (built on reka-ui) + class-variance-authority + @lucide/vue
Build: Vite + Vercel (hosting + serverless functions)
Testing: Vitest (unit) + Cypress (e2e)
Linting: @antfu/eslint-config + eslint-plugin-tailwindcss

## Commands

```bash
pnpm dev                # Dev server
pnpm build              # Type-check + production build
pnpm lint               # ESLint
pnpm lint:fix           # ESLint with auto-fix
pnpm type-check         # vue-tsc type checking

pnpm test:unit          # Unit tests (Vitest, watch mode)
pnpm vitest run         # Unit tests (single run)
pnpm vitest src/lib/__tests__/track.spec.ts  # Single test file

pnpm test:e2e:dev       # E2E tests against dev server
pnpm cypress run --spec "cypress/e2e/[file].cy.ts"  # Single e2e test
```

## Architecture — Vertical Slices

The codebase is organized by **vertical slices** under `src/pages/`. Each slice owns its components, stores, types, and services. Shared code lives at `src/` level.

- **Slice-local code** (used only within one slice) → `src/pages/<slice>/` (components, stores, types)
- **Shared code** (used across slices) → `src/` level (stores, types, lib, services, components/ui)
- When a slice-local module starts being used by another slice, **promote it** to `src/`

```
src/
├── types/                # Shared Zod schemas + TS types, split by domain (spotify, game, message)
├── consts.ts             # LocalStorage keys, animation durations, responsive breakpoints
├── stores/               # Shared Pinia stores (connection, gameData, result, library)
├── services/             # Shared services (spotify, library)
├── lib/                  # Shared utilities (spotify fetch wrapper, track utils, cn())
├── composables/          # Shared composables
├── router/index.ts       # Routes + beforeGameEnter guard
├── components/ui/        # shadcn-vue primitives (button, dialog, toast, etc.)
├── pages/
│   ├── game/             # Game slice
│   │   ├── components/   # Game-only components (player, trackDisplay, guessLevelIcon, playerResult)
│   │   ├── stores/       # Game-only stores (musicPlayer, settings, spotifyLibrary)
│   │   ├── types.ts      # Game-only types (SpotifyPlayedTrack, MusicPlayer)
│   │   ├── setup/        # Game setup view
│   │   ├── round/        # In-game round view
│   │   ├── roundResult/  # Round result view
│   │   ├── result/       # Final result view
│   │   └── layout/       # Game layout wrapper
│   ├── cover/            # Cover Creator slice (own stores, types, components)
│   ├── home/             # Home slice
│   ├── library/          # Library slice
│   └── disclaimer/       # Disclaimer slice
api/
└── token/                # Vercel serverless functions for Spotify OAuth
```

## Environment Variables

- `VITE_SPOTIFY_URL` — Spotify API base URL (client-side)
- `VITE_WEB_SOCKET_URL` — WebSocket server URL (client-side)
- `CLIENT_ID`, `CLIENT_SECRET`, `SCOPE`, `STATE` — Spotify OAuth (server-side, in Vercel Functions)

## Key Conventions

- **Schema-first types**: define Zod schema, infer TS type with `z.infer<>` — never define types separately from their runtime validation
- **Store access**: import from `@/stores` barrel, not individual store files
- **Service access**: use `SpotifyService.method()` namespace pattern via `@/services` barrel
- **Path alias**: `@/` maps to `src/`
- **WebSocket messages**: validated with `messageSchema` discriminated union on `$type` field (`src/types/message.ts`)
- **Audio playback**: abstracted via `MusicPlayer` interface — two implementations (Spotify SDK, HTML audio)

## Additional Documentation

Check these files for deeper context when working in related areas:

| File                                                                             | When to check                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) | Modifying stores, services, WebSocket handling, auth flow, UI components, or adding new features |
