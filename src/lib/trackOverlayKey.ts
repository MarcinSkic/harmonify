export interface OverlayKeySource {
  musicBrainzId?: string
  albumId?: string
  discNumber?: number
  track?: number
  title: string
}

/**
 * `musicBrainzId` survives moving to a different Navidrome instance with the same collection, so it
 * is the preferred key. Tracks without one (<1% of a library, see plan) fall back to a composite key
 * built from fields that are stable across a rescan of the same files.
 */
export function deriveOverlayKey(source: OverlayKeySource): string {
  if (source.musicBrainzId)
    return source.musicBrainzId
  return `${source.albumId ?? ''}|${source.discNumber ?? ''}|${source.track ?? ''}|${source.title}`
}
