import type { FrozenNavidromeTrack } from '@/services/navidromeGameSource'

/**
 * Resolves the host's cheat-input text against a frozen Navidrome pool.
 *
 * An exact hit on `id` (`song.id`) or `overlayKey` (the MusicBrainz id, when the track has one)
 * wins outright — a title scan could otherwise dilute it with tracks that merely contain the same
 * string. `overlayKey` is not unique (two rips of one recording share an MBID), so an exact hit can
 * still be several tracks, which the caller reports as ambiguous like any other. Anything else is a
 * title substring search returning every match.
 *
 * Neither key is enough on its own: `song.id` appears in no export or table, and only ~79% of the
 * pool carries an MBID (decision W3).
 */
export function findFrozenTracks(tracks: FrozenNavidromeTrack[], input: string): FrozenNavidromeTrack[] {
  const needle = input.trim().toLowerCase()
  if (!needle)
    return []

  const exact = tracks.filter(t =>
    t.id.toLowerCase() === needle || t.overlayKey.toLowerCase() === needle,
  )
  if (exact.length > 0)
    return exact

  return tracks.filter(t => t.title.toLowerCase().includes(needle))
}

/**
 * Human-readable label for an ambiguous candidate: `song.id` is opaque and the overlay key is a
 * bare MBID, so the host picks between tracks by what they can actually read.
 */
export function describeFrozenTrack(track: FrozenNavidromeTrack): string {
  const parts = [track.artist, track.albumName].filter((p): p is string => !!p)
  return parts.length > 0 ? `${track.title} — ${parts.join(' — ')}` : track.title
}
