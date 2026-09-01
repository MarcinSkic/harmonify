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
