# Connecting Harmonify to Navidrome

Since v5 Harmonify can play from your own [Navidrome](https://www.navidrome.org/) server. This
document describes what has to be configured on the Navidrome side and what Harmonify stores in
your browser.

## 1. Connecting

On the Harmonify home page click the connection badge in the top-right corner (or the **Navidrome**
tile) and provide:

- the **server address** — complete, with scheme and port, e.g. `http://192.168.1.10:4533`
  or `https://music.example.com`,
- your Navidrome **username and password**.

Harmonify verifies the connection immediately (`/rest/ping.view`) and shows the server version.

### Common errors and what to do about them

| Message                                            | Cause                                                                                                                      | What to fix                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The browser blocks this connection (HTTPS → HTTP)  | Harmonify is served over HTTPS while Navidrome runs over HTTP. The browser blocks such a request before it leaves the page | Run the standalone Harmonify build (over HTTP), put HTTPS in front of Navidrome (reverse proxy), or allow insecure content for this site in your browser |
| Could not reach the server                         | Wrong address, missing port, server is down                                                                                | Check the address including the `http://`/`https://` scheme and the port (`4533` by default)                                                             |
| The server blocks requests from the browser (CORS) | Navidrome answers, but does not allow requests from the Harmonify origin                                                   | See section [4. CORS](#4-cors)                                                                                                                           |
| Wrong username or password                         | Bad credentials                                                                                                            | Sign in to the Navidrome web UI with the same credentials to confirm them                                                                                |
| This is not a Navidrome server                     | Something else answers at that address (a router, another Subsonic server)                                                 | Fix the address                                                                                                                                          |
| Data in an unknown format                          | The native API changed its response shape                                                                                  | See section [3. Tested versions](#3-tested-versions)                                                                                                     |

## 2. Custom tags (`grouping` and `work`)

Harmonify reads two custom tags from Navidrome to build categories and to keep the draw varied:

| Tag        | What Harmonify uses it for                        |
| ---------- | ------------------------------------------------- |
| `grouping` | kind of track (e.g. `op`, `ed`, `insert`)         |
| `work`     | the work a track comes from (e.g. a series title) |

Navidrome does not map arbitrary file tags by default — they have to be described in the `Tags.*`
section of the configuration (`navidrome.toml`) or through the matching environment variables
(`ND_TAGS_<NAME>_<FIELD>`). Example:

```toml
[Tags.grouping]
Aliases = [
  "grouping",
  "contentgroup"
]
Split = [
  ";",
  "/"
]
MaxLength = 100

[Tags.work]
Aliases = [ "work" ]
Split = [ ";" ]
MaxLength = 200
```

- **`Aliases`** — the tag names inside your files (FLAC/MP3) that Navidrome should read the value
  from.
- **`Split`** — separators the value is split on. Tags in Harmonify are **multi-valued**:
  `grouping = "op;insert"` with `Split = [";"]` yields two values.
- **`Type`** — the value type (e.g. `int`); omitted means text.
- **`MaxLength`** — truncation of overly long values.

> **`popularity` is deliberately not on this list.** It is a subjective rating made for the quiz,
> not a property of the music, so it lives in Harmonify's own local overlay (added in Phase 1) and
> never in your files. Harmonify stays read-only towards Navidrome and towards the music itself —
> using it must not require editing someone else's collection.

> Coverage in the library Phase 0 was accepted on: of the first 400 tracks returned by `/api/song`
> in the default order (out of 4812 in the library), 216 carried `work` and 72 carried `grouping`.
> That is not a random sample, so read it as an illustration of what a partially tagged library
> looks like, not as an estimate of coverage.

> Field names do change between Navidrome versions — if the server refuses to start after a
> configuration change, check the custom tags section in the documentation of **your** version.

### Why a full scan is required after changing the tag configuration

Navidrome maps tags **at scan time** and stores the resulting values in its own database. A regular
(quick) scan only looks at files changed since the last scan — your files did not change, so the new
configuration is never applied to them and the tracks stay untagged.

After every change to the `Tags.*` section run a **full scan** of the library (in the Navidrome web
UI: _Settings → full scan_, or `navidrome scan --full` from the command line).

You can check the result straight away in Harmonify: `/navidrome` → an album or a playlist → the tag
icon next to a track. If you see "This track has no custom tags", either the mapping or the scan is
still missing.

## 3. Tested versions

Harmonify talks to Navidrome through **two** APIs:

- **Subsonic** (`/rest/*`) — stable and versioned; albums, playlists, tracks, cover art and the
  audio stream come from here.
- **the native Navidrome API** (`/auth/login`, `/api/song/...`) — **undocumented and unstable**; used
  only for signing in and for reading custom tags, because Subsonic does not expose them.

That is why Harmonify checks the server version. Outside the tested range you get a **warning**
(never a block) — the app keeps working, but if the native API changed its response shape you will
get a "Navidrome changed its API" message instead of a network error.

The current range is **0.54.0 (inclusive) – 0.64.0 (exclusive)**; it lives in the code as
`NAVIDROME_TESTED_RANGE` (`src/services/navidrome/subsonic.ts`) and is raised after a new version is
checked by hand. The manual acceptance of Phase 0 was done against **Navidrome 0.63.2**.

## 4. CORS

If Harmonify is hosted on a different address than Navidrome, the browser requires Navidrome to
allow requests from that address. Symptom: the message about the server blocking requests coming
from the browser.

What to do:

- add the Harmonify origin to the allowed origins in the Navidrome configuration
  (the `AllowedOrigins` / `ND_ALLOWEDORIGINS` option — the exact name depends on the version), or
- put both behind the same reverse proxy so they share an origin, or
- use the standalone Harmonify build, running locally.

If you use a reverse proxy, make sure it does **not** strip the `x-nd-authorization` response header
and does not block it for cross-origin requests — Navidrome uses it to refresh the session token.

## 5. What Harmonify stores in your browser

In `localStorage`, under the `navidrome_session` key:

- the server address and the username,
- the Navidrome session token (JWT),
- the `subsonicSalt` + `subsonicToken` pair used to authenticate Subsonic requests.

**The password is not stored anywhere** — neither in `localStorage`, nor in IndexedDB, nor in the
app's memory after signing in. It only goes to your server when signing in and is used to compute
the `salt` + `token` pair, after which it is dropped. When the session expires Harmonify asks for it
again.

An honest note: **`subsonicToken` is equivalent to the password in terms of replay** — anyone who
has it can issue any Subsonic request on your account. The Navidrome web client stores it exactly
the same way. The gain over storing the password is a different one: your password, which you may
have reused elsewhere, does not leak.

Phase 0 **imports nothing** from Navidrome into Harmonify's local database (IndexedDB) — browsing
the library and previewing audio go straight to the server.

Since Phase 1, per-track annotations (`playbackRange`, `previewImageUrl`, whether a track is
enabled, and any custom field such as `popularity`) live in a local overlay, described below.

## 6. Track overlay: annotating tracks without touching your files

Harmonify never writes to Navidrome or to your music files. Instead, `/navidrome` → an album or
playlist → the pencil icon on a track opens an editor for a local **overlay**: playback range,
preview image, enabled/disabled, and any number of custom fields (name + value, e.g.
`popularity` → `8`). This overlay is stored in Harmonify's IndexedDB, keyed so it survives moving
to a different Navidrome instance that serves the same collection (§ below).

### The matching key

Each overlay is keyed by `musicBrainzId` when the track has one (tagged as `musicbrainz_trackid`
in your files and mapped by Navidrome at scan time). A track without one falls back to
`albumId|discNumber|track|title` when you edit it live from `/navidrome` — that composite key is
only ever computed from the fields of the real track you have open, never from text typed into a
CSV cell (see below).

### CSV import/export

`/navidrome` → the tabs view (Albums/Playlists) has **Import CSV** / **Export CSV** buttons for
the whole overlay table.

**Export CSV** columns, in order: `musicBrainzId, albumId, discNumber, track, title, artist,
playbackRange, previewImageUrl, enabled`, followed by every custom field name in use across all
overlays (sorted alphabetically, one column per name, exactly as you typed it). `playbackRange` is
formatted `mm:ss-mm:ss`. Example row:

```csv
musicBrainzId,albumId,discNumber,track,title,artist,playbackRange,previewImageUrl,enabled,popularity
f4a1b2c3-...,al-42,1,7,Sample Track,Sample Artist,0:15-0:45,https://example.com/cover.jpg,true,8
```

**Import CSV**: `musicBrainzId` is the **only** matching key — a row without it (empty cell or a
missing column) is **not applied** and is reported as skipped, with its `title` (if the column is
present) shown in the toast so you know which track to fix. There is no silent fallback to
`albumId`/`discNumber`/`track`/`title` on import: those columns exist in the export purely for
readability, not for matching, because CSV text is outside the app's control and matching a track
by a title typed by hand risks silently annotating the wrong one. Any column that is not one of
the known ones above becomes a custom field, keeping the exact header spelling (`Popularity` stays
`Popularity`, not `popularity`).

**Practical consequence:** if a track has no `musicBrainzId`, export→reimport of your own CSV is
not a full round trip for it — its overlay comes back reported as skipped and has to be re-entered
by hand through the editor (or you tag `musicbrainz_trackid` in the file and rescan Navidrome
first). This affects a small minority of a typical library.

### Migrating an old, `sourceId`-keyed annotation sheet

If you have annotations from before Phase 1, keyed by the old per-server `sourceId`, there is no
automatic migration — the sourceId is server-specific and does not survive a rescan or a different
instance. Open the album/playlist in `/navidrome` and use **Export IDs** (next to the track table)
to get a CSV of `index, musicBrainzId, title` for the currently loaded tracks, in the same order as
shown on screen. Use it as a bridge to match your old sheet's rows to `musicBrainzId` by hand, then
build (or hand-edit) an overlay CSV in the format above and import it.
