# Architectural Patterns

Companion to `CLAUDE.md`. `CLAUDE.md` states the conventions; this file explains the mechanisms behind them.

File paths below are deliberately given without line numbers — grep for the named symbol. If a path here disagrees with the actual tree, the tree wins; fix this file.

## Two Schema Homes — Wire Types vs Persisted Entities

Zod is the single source of truth for both, but they live apart and must not be merged:

| Location          | Holds                                                 | Split                                                      |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `src/types/`      | **Wire types** — data crossing a network boundary     | `spotify.ts`, `game.ts` (Harmonify API DTOs), `message.ts` |
| `src/db/schemas.ts` | **Persisted entities** — everything stored in IndexedDB | one file: Track, Playlist, Category, CategorySet, GameResult, LocalGame, LinkPreview, … |

- `src/types/index.ts` is a barrel (`export * from './game'` etc.) — import from `@/types`. Deep imports (`@/types/spotify`) are used only inside `src/types/` itself and where a slice extends a specific schema, as in `src/pages/game/types.ts`.
- `src/db/schemas.ts` is imported directly as `@/db/schemas` (it has no barrel of its own).
- Rule of thumb: **does it arrive over the network → `src/types/`; does it get written to Dexie → `src/db/schemas.ts`.** `src/db/schemas.ts` may import from `@/types` (e.g. `localGuessLevelSchema`), never the reverse.

### Schema-first type derivation

- Pattern: `const fooSchema = z.object({...})` then `export type Foo = z.infer<typeof fooSchema>`. Never write a TS type that parallels a schema.
- Schemas compose via `.extend()` (`playerSchema` extends `playerDtoSchema`), `.extract()` (`localGuessLevelSchema` narrows `guessLevelSchema`), and generics (`getAlbumSchema<T>` in `src/types/spotify.ts`).
- **Accepted exception:** a plain `interface` is fine for an internal shape that never crosses a runtime boundary — e.g. `TrackAnnotation` in `src/db/schemas.ts`, the intermediate produced by CSV parsing before it is merged into a `Track`. Anything actually parsed from outside the app must have a schema.

## Reactive IndexedDB — Dexie + `useLiveQuery`

Persistent state lives in IndexedDB (database `harmonifyLibrary`), not in Pinia. Pinia stores wrap it.

- `src/db/index.ts` declares the typed `db` instance and all `db.version(N).stores({...})` migrations. Schema changes are **additive versions** with an `.upgrade(tx => ...)` callback — never edit an existing version block.
- `src/composables/useLiveQuery.ts` bridges Dexie's `liveQuery` observable into a Vue `Ref`: it subscribes, re-subscribes when the declared `deps` change, and unsubscribes on `onScopeDispose`.
- Stores expose live data by assigning the result of `useLiveQuery` to a store property — see `src/stores/library.ts` (`playlists`, `tracks`, `allTags`) and `src/stores/categories.ts`. Components then read the store; they do not call Dexie themselves.
- **Library writes** (playlists, tracks, categories, category sets) go through `LibraryService`, never `db.*` in a component. The `liveQuery` subscription propagates the change back automatically — no manual refetch.
- Raw `db.*` reads do appear in a few views (`LibraryTrackPicker.vue`, `LocalSetupView.vue`, `LocalResultView.vue`). Treat them as leftovers, not as a sanctioned shortcut — new code should go through a store or a service.
- The `localGames` and `gameResults` tables have **no service layer**: `src/pages/local/stores/localGame.ts` and the `beforeLocalGameEnter` guard hit `db` directly. That is a gap, not a design — see *Known debt* below.

## Namespace-Style Service Exports

Services are modules of stateless functions, re-exported as namespaces from `src/services/index.ts` and consumed as `LibraryService.method()`:

| Service               | Module            | Concern                                                        |
| --------------------- | ----------------- | -------------------------------------------------------------- |
| `LibraryService`      | `library.ts`      | All Dexie CRUD: playlists, tracks, categories, category sets   |
| `LibraryImportService`| `library-import.ts` | Track shape conversion + import from Spotify into the library |
| `LinkPreviewService`  | `link-preview.ts` | Queued fetching of link preview images, with retry             |
| `MusicServerService`  | `music-server.ts` | Local music server: playlists, tracks, audio/cover URLs, auth  |
| `SpotifyService`      | `spotify.ts`      | Spotify Web API reads (playlists, albums, tracks)              |

- Pattern in the barrel: `export * as LibraryService from './library'`.
- **Accepted exception:** `export * as` does not re-export *types*, so a type-only deep import is allowed — `import type { ServerPlaylist } from '@/services/music-server'` in `src/stores/serverLibrary.ts`. Value imports must still go through the barrel.
- **Accepted exception:** `NavidromeService` is **not** stateless — `src/services/navidrome/client.ts` owns the persisted session ref (`getSession` / `setSession` / `clearSession`, `useStorage` on `LOCAL_STORAGE.NAVIDROME_SESSION`) and rewrites the JWT from the `x-nd-authorization` header on every native response. The store (`src/stores/navidrome.ts`) reads it through `computed(() => NavidromeService.getSession())` instead of holding its own copy, for two reasons that are visible in the code: putting the ref in the store would close an import cycle (`stores/navidrome` → `@/services` → `navidrome/client` → `@/stores`), and components call the service directly (`getCoverArtUrl`, `getStreamUrl`, `getSongTags`), so the service has to see the refreshed token without going through Pinia.

## Pinia Store Organization

Shared stores live in `src/stores/`, re-exported via `src/stores/index.ts` — always import from `@/stores`. Slice-local stores live in `src/pages/<slice>/stores/` with their own barrel.

**Shared** (`src/stores/`):

| Store            | Concern                                                        |
| ---------------- | -------------------------------------------------------------- |
| `connection`     | WebSocket lifecycle, message dispatch                          |
| `gameData`       | Current multiplayer game state (room, players, round, settings) |
| `result`         | Round + game scoring, sorted leaderboards                      |
| `settings`       | User preferences (autoplay, animations, visualizer, hide scores)|
| `library`        | Local library: playlists, tracks, selection, tags               |
| `categories`     | Categories (tag-filter based)                                  |
| `categorySets`   | Ordered sets of categories                                     |
| `serverLibrary`  | Music-server playlists + load state                            |
| `spotifyLibrary` | Spotify playlist/album selection and track fetching            |

**Slice-local:** `src/pages/game/stores/` (`musicPlayer`), `src/pages/local/stores/` (`localGame`), `src/pages/cover/stores/` (`covers`).

Note that `settings` and `spotifyLibrary` used to be game-slice stores and were **promoted** to `src/stores/` once the local-game and library slices needed them. That promotion — not duplication, not a cross-slice import — is the prescribed response to shared slice code.

### Store definition style

Both styles exist. **Setup style (`defineStore('name', () => {...})`) is the direction of travel** and what new stores use — it is required when the store holds `useLiveQuery` refs or computed values (`library`, `categories`, `categorySets`, `serverLibrary`, `spotifyLibrary`). Options style (`{ state, getters, actions }`) remains in the older multiplayer stores (`connection`, `gameData`, `result`, `settings`); leave them as they are unless you are rewriting one anyway.

## The Local Game Engine — Pure Functions + Store Orchestration

The single-device game (`src/pages/local/`) is architecturally distinct from the multiplayer game: there is no server, so round logic lives in the client as **pure, state-in/state-out functions**.

- `src/pages/local/engine/trackPool.ts` — `createPool(trackIds)`, `pickRandom(state)` returning `{ trackId, newState }`, `isExhausted(state)`.
- `src/pages/local/engine/categoryPool.ts` — the same shape for category mode, plus `getCategoryCounts` and the `EngineCategory` union (a stored `Category` or a `PlaylistBasedCategory`).
- Engine functions never touch Dexie, Pinia, or Vue. They are unit-tested directly in `src/pages/local/engine/__tests__/`.
- `src/pages/local/stores/localGame.ts` is the only orchestrator: it calls the engine, holds the current `LocalGame`, and persists pool state (`TrackPoolState` / `CategoryPoolState` are themselves schemas in `src/db/schemas.ts`) into the `localGames` table, so a game survives a reload.
- Finished games are validated with `gameResultSchema` and written to the `gameResults` table. The `results` slice (`src/pages/results/`) reads them back through `localGameStore.findAllGameResults()`.

**When adding local-game rules, put the decision logic in `engine/` with a test, and keep the store as wiring.**

That is the intent. The store has outgrown it — see below.

## Known debt

The `local` slice was written quickly and is a **cleanup target, not a reference**. Read patterns out of `src/stores/`, `src/services/`, `src/pages/library/`, and `src/pages/game/` instead. The `engine/` split is the exception: pure, tested functions, and the shape the rest of the slice should move toward.

Specifically:

- **`src/pages/local/stores/localGame.ts` is a god store** — ~650 lines, a dozen computeds and around forty actions covering game lifecycle, category selection, scoring, team management, persistence, and game-result CRUD including JSON import/export.
- **The game-result CRUD block** (`findAllGameResults`, `deleteGameResult`, `exportGameResult`, `importGameResult`, `findAllUnfinishedGames`) is the reason `src/pages/results/` and `src/pages/home/` import `useLocalGameStore` across a slice boundary. Splitting it into its own store or service — and giving `localGames` / `gameResults` a service layer next to `LibraryService` — removes those imports.
- **Cross-slice imports out of `local/`**: `useMusicPlayerStore`, `AudioVisualizer`, and `trackDisplay/BaseDisplay` are pulled from `@/pages/game/`. By this document's own rule they should be promoted to `src/stores/` and `src/components/`. `GameListItem` and `GameResultTabs` live in `local/components/` but are used by `home/` and `results/`, so they promote too.
- Raw `db.*` reads in `LocalSetupView.vue` and `LocalResultView.vue`.

None of this is load-bearing — it is ordinary debt with a known direction. Do not cite `local/` as precedent while it is being paid down.

## MusicPlayer Interface Abstraction

Audio playback is abstracted behind the `MusicPlayer` interface (`src/pages/game/types.ts`) — `_turnOn`, `_preload`, `_play`, `_seek`, `_resume`, `_pause`, `_setVolume`. Two implementations, both in `src/pages/game/layout/components/`:

- **SpotifyPlayer.vue** — wraps the Spotify Web Playback SDK, injected via the `onSpotifyWebPlaybackSDKReady` global callback.
- **PreviewPlayer.vue** — a plain `<audio>` element driven by `useMediaControls` from `@vueuse/core`; also used for local files served by the music server.

Both assign themselves to `useMusicPlayerStore().player`, and the store (`src/pages/game/stores/musicPlayer.ts`) delegates each method to whichever player is current. The rest of the app is player-agnostic.

## WebSocket Message Handling

The connection store (`src/stores/connection.ts`, options style) owns a single `WebSocket`:

1. A view registers handlers via `connectionStore.openConnection(path, { handleOpen, handleMessage, handleError })`, or swaps in its own handler by assigning `connectionStore.handleMessage` in `onBeforeMount`.
2. The store's internal `handleMessageWrapper` parses the raw event with `messageSchema.parse()` first, then handles cross-cutting concerns (player list updates, pause/resume, end-game navigation), and only then delegates to the view handler.
3. Each game view swaps in its own handler: `src/pages/game/setup/SetupView.vue`, `round/RoundView.vue`, `roundResult/RoundResultView.vue`. `src/pages/home/components/CreateRoom.vue` and `JoinRoom.vue` pass handlers to `openConnection` directly.

`messageSchema` (`src/types/message.ts`) is a `z.discriminatedUnion` on the `$type` field, which carries the server's C# type name (e.g. `message/roundStartedDto`). Adding a server message means adding a variant there — nothing dispatches on an unvalidated string.

## Routing and Route Guards

`src/router/index.ts` holds every route (all components lazily imported) and two guards:

- `beforeGameEnter` — on the `/game` parent route. Skips if a WebSocket already exists; otherwise opens a connection and awaits a `playerInfoDto` message wrapped in a Promise. On success joins the game and redirects to `setup`; on failure redirects to `home`.
- `beforeLocalGameEnter` — on `/local/:id/round` and `/local/:id/result`. Redirects to `localSetup` when the requested local game is not loadable.

Top-level routes: `/` (home), `/game/*`, `/local/*`, `/results`, `/results/:id`, `/library`, `/library/categories`, `/library/category-sets`, `/cover`, `/disclaimer`.

## Centralized Spotify HTTP Layer

All Spotify API calls go through `fetchFromSpotify()` (`src/lib/spotify.ts`), which:

- Prepends the `VITE_SPOTIFY_URL` base for relative paths
- Attaches the `Authorization: Bearer` header
- Redirects to `/api/token/expired` on 400/401 (triggering the token refresh flow)
- Redirects to the disclaimer page on 403

Paginated endpoints use `getAllPaginatedItems()` in the same file — a generic cursor-following loop that validates each page with a Zod schema.

## Music Server Access

`src/services/music-server.ts` talks to the bundled ASP.NET Core server. It reads its configuration from env at module scope with `?? ''` fallbacks and exposes `isConfigured()` so the UI can hide server features when unset. `needsAuth()` + `fetchAudioBlobUrl()` handle endpoints that require the basic-auth header; `getAudioUrl` / `getCoverUrl` / `getPlaylistCoverUrl` return plain URLs for the rest.

## Library Import Pipelines

Three ways tracks and metadata enter the local library, all converging on `LibraryService`:

- **Spotify** — `LibraryImportService.importFromSpotify()`, with `spotifyTrackToTrack` / `trackToSpotifyTrack` bridging the wire type and the persisted entity.
- **Music server** — `MusicServerService.getTracks()` feeding the same conversion path.
- **CSV** — `parseCSV()` in `src/lib/csv.ts` produces `TrackAnnotation[]`, applied by `LibraryService.applyCSVToPlaylist()`, which reports `{ updated, notFound, previewUrls }`. Categories and category sets have their own serialize/parse pairs in the same file.

Deduplication on insert is `LibraryService.addTracksDeduplicating()`. After an import that yields preview URLs, `LinkPreviewService.triggerForUrls()` kicks off the background preview queue.

## Shared Composables

`src/composables/` holds cross-slice composables only:

- `useLiveQuery` — Dexie → Vue reactivity (see above)
- `useLinkPreview` — resolves a preview image for a URL, driving the `linkPreviews` table
- `useLoadServerLibrary`, `useLoadSpotifyLibrary` — `onMounted` loaders that fill the corresponding store once, toast on failure, and are safe to call from multiple views

## shadcn-vue UI Components

UI primitives in `src/components/ui/` follow the shadcn-vue pattern and are **generated** — they are added with `pnpm dlx shadcn-vue@latest add <component>`, not hand-written, and they follow shadcn's conventions rather than this project's.

- Built on `reka-ui` headless primitives
- Styled with TailwindCSS + `class-variance-authority` (CVA) for variants
- Each component folder has an `index.ts` barrel exporting the component and its variant definitions
- `cn()` (`src/lib/utils.ts`) merges Tailwind classes via `clsx` + `tailwind-merge`

Toasts are `vue-sonner` (`toast.success` / `.warning` / `.error`), icons are `@lucide/vue`.

## Persisted User Preferences

Preferences use `useStorage()` from `@vueuse/core` with keys from the `LOCAL_STORAGE` const object in `src/consts.ts` — never a raw `localStorage` call or an inline key string. Used by the `settings` store (autoplay, animations, visualizer, hide scores, default save game), `musicPlayer` (volume), and `covers` (saved covers). `src/consts.ts` also holds `DEFAULT_COVER`, the `AnimationDuration` enum, and the `Breakpoint` enum.

## Responsive Layout Strategy

Responsive behavior is decided in script, not only in CSS: `useWindowSize()` from VueUse compared against the `Breakpoint` enum from `src/consts.ts`.

```ts
const isDesktop = computed(() => screenWidth.value >= Breakpoint.LG)
```

Desktop and mobile variants are then conditionally rendered as separate components (e.g. `DesktopResultView` / `MobileResultView` in `src/pages/game/result/components/`).

## Environment Variables

Client-side (`import.meta.env`, all optional — features degrade when unset):

| Variable                      | Used by                                            |
| ----------------------------- | -------------------------------------------------- |
| `VITE_SPOTIFY_URL`            | `src/lib/spotify.ts`, `src/services/spotify.ts`    |
| `VITE_WEB_SOCKET_URL`         | `src/stores/connection.ts`; also gates the multiplayer entry in `HomeView.vue` |
| `VITE_MUSIC_SERVER_URL`       | `src/services/music-server.ts`                     |
| `VITE_MUSIC_SERVER_USER`      | `src/services/music-server.ts` (basic auth)        |
| `VITE_MUSIC_SERVER_PASSWORD`  | `src/services/music-server.ts` (basic auth)        |

`env.d.ts` is only `/// <reference types="vite/client" />` — there is no typed `ImportMetaEnv`, so these are `string | undefined` and every read supplies a fallback.

Server-side (Vercel Functions): `CLIENT_ID`, `CLIENT_SECRET`, `SCOPE`, `STATE`.

## Serverless API (Vercel Functions)

OAuth token management lives in `api/token/`:

| Endpoint   | Purpose                                           |
| ---------- | ------------------------------------------------- |
| `request`  | Redirects to the Spotify OAuth authorize URL      |
| `callback` | Exchanges the auth code for tokens, sets cookies  |
| `refresh`  | Uses the refresh_token cookie to get a new access_token |
| `expired`  | Clears cookies, redirects to `request`            |

Tokens are stored as HTTP cookies: `access_token` is client-readable, `refresh_token` is `HttpOnly`. Shared helpers in `api/token/common.ts`. These functions validate their inputs with inline Zod schemas, same as the client.
