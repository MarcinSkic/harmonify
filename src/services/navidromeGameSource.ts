import type { FrozenNavidromeTrack, NavidromeGameSourceRef } from '@/db/schemas'
import type { FieldBag } from '@/lib/categoryPredicate'
import type { NavidromeError, SubsonicSong } from '@/services/navidrome'
import { deriveOverlayKey } from '@/lib/trackOverlayKey'
import { LibraryOverlayService, NavidromeService } from '@/services'

export type { FrozenNavidromeTrack, NavidromeGameSourceRef } from '@/db/schemas'

function fetchSourceTags(source: NavidromeGameSourceRef): Promise<Map<string, Record<string, string[]>>> {
  return source.type === 'album'
    ? NavidromeService.getAlbumSongTags(source.id)
    : NavidromeService.getPlaylistSongTags(source.id)
}

/**
 * Navidrome tags plus the overlay's custom fields, **the overlay winning on a name collision**: it
 * is the more local value and the one the host set on purpose. Overlay values are single strings,
 * so each becomes a one-element list to match the multi-valued shape of a tag.
 */
function mergeFields(tags: Record<string, string[]>, customFields: Record<string, string>): FieldBag {
  const fields: FieldBag = { ...tags }
  for (const [name, value] of Object.entries(customFields))
    fields[name] = [value]

  return fields
}

/**
 * `song.id` ends up persisted here (the frozen pool of a `LocalGame`), which looks like it breaks the
 * "song.id never reaches persistence" rule from the main plan (§1, point 2) — it doesn't. That rule
 * protects the *overlay key*, which must survive switching Navidrome instances, so it can never be
 * keyed by `song.id`. A frozen game pool is a different thing entirely: a snapshot needed only to
 * finish *this* particular game against *this* particular instance (audio still streams via
 * `song.id`). The portability test targets the overlay, not in-flight/finished games — consistent
 * with old games not being resumable after migration.
 */
export async function materializePool(
  sources: NavidromeGameSourceRef[],
): Promise<{ tracks: FrozenNavidromeTrack[], tagsError: NavidromeError | null }> {
  const songsById = new Map<string, SubsonicSong>()
  const tagsBySongId = new Map<string, Record<string, string[]>>()
  let tagsError: NavidromeError | null = null

  for (const source of sources) {
    // Two APIs per source: Subsonic for the song shape (stable contract, no field remapping) and
    // the native one for the tag map. Independent requests, so they go out together.
    const [{ songs }, tags] = await Promise.all([
      source.type === 'album'
        ? NavidromeService.getAlbum(source.id)
        : NavidromeService.getPlaylist(source.id),
      fetchSourceTags(source).catch((error) => {
        // Missing tags degrade the game to "no categories match", they do not abort materialization
        // — the caller decides what to tell the user. The error itself is carried out rather than a
        // flag, because an expired session has to reach the store to be actionable. Anything that is
        // not a Navidrome failure is a bug and still propagates.
        if (!(error instanceof NavidromeService.NavidromeError))
          throw error

        // The first failure wins: with several sources the diagnosis is the same for all of them.
        tagsError ??= error
        return new Map<string, Record<string, string[]>>()
      }),
    ])

    for (const song of songs)
      songsById.set(song.id, song)
    for (const [songId, songTags] of tags)
      tagsBySongId.set(songId, songTags)
  }

  const songs = [...songsById.values()]
  const overlayKeyBySongId = new Map(songs.map(song => [
    song.id,
    deriveOverlayKey({
      musicBrainzId: song.musicBrainzId,
      albumId: song.albumId,
      discNumber: song.discNumber,
      track: song.track,
      title: song.title,
    }),
  ]))
  const overlays = await LibraryOverlayService.getOverlaysByKeys([...new Set(overlayKeyBySongId.values())])

  const pool: FrozenNavidromeTrack[] = []
  for (const song of songs) {
    const overlayKey = overlayKeyBySongId.get(song.id)!
    const overlay = overlays.get(overlayKey)
    if (overlay?.enabled === false)
      continue

    pool.push({
      id: song.id,
      overlayKey,
      title: song.title,
      artist: song.artist,
      albumName: song.album,
      albumId: song.albumId,
      coverArt: song.coverArt,
      durationMs: song.duration != null ? song.duration * 1000 : undefined,
      playbackRange: overlay?.playbackRange ?? null,
      previewImageUrl: overlay?.previewImageUrl,
      fields: mergeFields(tagsBySongId.get(song.id) ?? {}, overlay?.customFields ?? {}),
    })
  }

  return { tracks: pool, tagsError }
}
