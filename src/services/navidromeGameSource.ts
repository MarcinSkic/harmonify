import type { PlaybackRange } from '@/db/schemas'
import type { SubsonicSong } from '@/services/navidrome'
import { deriveOverlayKey } from '@/lib/trackOverlayKey'
import { LibraryOverlayService, NavidromeService } from '@/services'

export interface NavidromeGameSourceRef {
  type: 'album' | 'playlist'
  id: string
  name: string
  imageUrl?: string
}

export interface FrozenNavidromeTrack {
  id: string // song.id — an ephemeral handle, only valid for the lifetime of this frozen game (see note below)
  overlayKey: string
  title: string
  artist?: string
  albumName?: string
  albumId?: string
  coverArt?: string
  durationMs?: number
  playbackRange: PlaybackRange | null
  previewImageUrl?: string
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
): Promise<FrozenNavidromeTrack[]> {
  const songsById = new Map<string, SubsonicSong>()

  for (const source of sources) {
    const { songs } = source.type === 'album'
      ? await NavidromeService.getAlbum(source.id)
      : await NavidromeService.getPlaylist(source.id)
    for (const song of songs)
      songsById.set(song.id, song)
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
    })
  }

  return pool
}
