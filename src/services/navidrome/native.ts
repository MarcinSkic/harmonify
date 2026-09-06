import { z } from 'zod'
import { nativeFetch, nativeFetchWithHeaders } from './client'
import { nativeLoginSchema, nativePlaylistTrackSchema, nativeSongSchema, nativeTagSchema } from './schemas'

/**
 * The native API is the unstable one, so it carries only what Subsonic cannot answer: logging in,
 * the tag map of a song or of a whole album/playlist, and the index of known tag names and values.
 * Everything with a stable contract — track shape, cover art, streaming — goes through Subsonic.
 */

/** Navidrome reads `_end=0` as "no limit" (verified live: 4826 songs, 7436 tags in one response). */
const NO_LIMIT = '_end=0'

/**
 * `_end=0` is not a documented contract, so every unbounded read cross-checks the row count against
 * `x-total-count`. A newer Navidrome quietly re-introducing a default page size would otherwise show
 * up as a game pool missing tags, not as an error. Warn only — a truncated answer is still usable,
 * and the header may be absent altogether when CORS does not expose it.
 */
function warnWhenTruncated(path: string, headers: Headers, received: number): void {
  const total = Number(headers.get('x-total-count'))
  if (Number.isFinite(total) && total > 0 && total !== received)
    console.warn(`Navidrome ${path} returned ${received} of ${total} rows — "_end=0" no longer disables pagination`)
}

export async function login(baseUrl: string, username: string, password: string): Promise<{ jwt: string, username: string }> {
  const payload = await nativeFetch('/auth/login', nativeLoginSchema, {
    baseUrl,
    method: 'POST',
    body: { username, password },
  })

  return { jwt: payload.token, username: payload.username }
}

/** Tag name → list of values; a song without custom tags yields an empty map. */
export async function getSongTags(songId: string): Promise<Record<string, string[]>> {
  const song = await nativeFetch(`/api/song/${encodeURIComponent(songId)}`, nativeSongSchema)

  return song.tags
}

/** Song id → its tag map, for every song of an album. Keys match Subsonic's `song.id` exactly. */
export async function getAlbumSongTags(albumId: string): Promise<Map<string, Record<string, string[]>>> {
  const path = `/api/song?album_id=${encodeURIComponent(albumId)}&${NO_LIMIT}`
  const { data, headers } = await nativeFetchWithHeaders(path, z.array(nativeSongSchema))
  warnWhenTruncated(path, headers, data.length)

  return new Map(data.map(song => [song.id, song.tags]))
}

/**
 * Song id → its tag map, for every track of a playlist. Keyed by `mediaFileId`, **not** by `id`:
 * a playlist entry's `id` is its position in the playlist (see `nativePlaylistTrackSchema`).
 */
export async function getPlaylistSongTags(playlistId: string): Promise<Map<string, Record<string, string[]>>> {
  const path = `/api/playlist/${encodeURIComponent(playlistId)}/tracks?${NO_LIMIT}`
  const { data, headers } = await nativeFetchWithHeaders(path, z.array(nativePlaylistTrackSchema))
  warnWhenTruncated(path, headers, data.length)

  return new Map(data.map(entry => [entry.mediaFileId, entry.tags]))
}

/**
 * Tag name → its known values across the whole library, unique and sorted. Feeds the suggestions of
 * the category editor; `/api/tag` carries no track counts, so it cannot answer "how many songs".
 */
export async function getTagIndex(): Promise<Map<string, string[]>> {
  const path = `/api/tag?${NO_LIMIT}`
  const { data, headers } = await nativeFetchWithHeaders(path, z.array(nativeTagSchema))
  warnWhenTruncated(path, headers, data.length)

  const valuesByName = new Map<string, Set<string>>()
  for (const tag of data) {
    const values = valuesByName.get(tag.tagName) ?? new Set<string>()
    values.add(tag.tagValue)
    valuesByName.set(tag.tagName, values)
  }

  return new Map([...valuesByName].map(([name, values]) => [name, [...values].sort()]))
}
