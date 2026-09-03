import type { Track } from '@/db/schemas'
import type { FrozenNavidromeTrack } from '@/services/navidromeGameSource'
import { NavidromeService } from '@/services'

/**
 * Builds a synthetic `Track` from a frozen Navidrome track for the round UI/player, which expect a
 * full `Track` shape. The result never reaches `db.tracks` — it only lives in the store's
 * `currentTrack` ref for the duration of the round.
 */
export function toDisplayTrack(t: FrozenNavidromeTrack): Track {
  return {
    id: t.id,
    sourceId: t.id,
    name: t.title,
    artists: t.artist ? [t.artist] : [],
    albumName: t.albumName ?? '',
    albumImageUrl: t.coverArt ? NavidromeService.getCoverArtUrl(t.coverArt) : undefined,
    audioUrl: NavidromeService.getStreamUrl(t.id),
    durationMs: t.durationMs ?? 0,
    playbackRange: t.playbackRange,
    previewImageUrl: t.previewImageUrl,
    tags: [],
    playlistIds: [],
    metadataSource: 'navidrome',
    enabledByPlaylist: {},
    createdAt: Date.now(),
  }
}
