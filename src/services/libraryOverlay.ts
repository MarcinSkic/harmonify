import type { OverlayField, TrackOverlay } from '@/db/schemas'
import type { OverlayKeySource } from '@/lib/trackOverlayKey'
import { db } from '@/db'
import { deriveOverlayKey } from '@/lib/trackOverlayKey'

type OverlaySource = OverlayKeySource & { artist?: string }

export async function getOverlay(key: string): Promise<TrackOverlay | undefined> {
  return db.trackOverlays.get(key)
}

export async function getOverlaysByKeys(keys: string[]): Promise<Map<string, TrackOverlay>> {
  const overlays = await db.trackOverlays.bulkGet(keys)
  const result = new Map<string, TrackOverlay>()
  for (const overlay of overlays) {
    if (overlay)
      result.set(overlay.id, overlay)
  }
  return result
}

export async function upsertOverlay(
  source: OverlaySource,
  patch: Partial<Pick<TrackOverlay, 'playbackRange' | 'previewImageUrl' | 'enabled'>>,
): Promise<void> {
  const id = deriveOverlayKey(source)
  const existing = await db.trackOverlays.get(id)
  await db.trackOverlays.put({
    id,
    musicBrainzId: source.musicBrainzId,
    albumId: source.albumId,
    discNumber: source.discNumber,
    track: source.track,
    title: source.title,
    artist: source.artist,
    playbackRange: existing?.playbackRange ?? null,
    previewImageUrl: existing?.previewImageUrl,
    enabled: existing?.enabled ?? true,
    customFields: existing?.customFields ?? {},
    ...patch,
    updatedAt: Date.now(),
  })
}

export async function setCustomField(source: OverlaySource, fieldName: string, value: string): Promise<void> {
  const id = deriveOverlayKey(source)
  const existing = await db.trackOverlays.get(id)
  await db.trackOverlays.put({
    id,
    musicBrainzId: source.musicBrainzId,
    albumId: source.albumId,
    discNumber: source.discNumber,
    track: source.track,
    title: source.title,
    artist: source.artist,
    playbackRange: existing?.playbackRange ?? null,
    previewImageUrl: existing?.previewImageUrl,
    enabled: existing?.enabled ?? true,
    customFields: { ...existing?.customFields, [fieldName]: value },
    updatedAt: Date.now(),
  })
}

export async function removeCustomField(key: string, fieldName: string): Promise<void> {
  const existing = await db.trackOverlays.get(key)
  if (!existing)
    return
  const { [fieldName]: _removed, ...customFields } = existing.customFields
  await db.trackOverlays.update(key, { customFields, updatedAt: Date.now() })
}

/**
 * Tagging a file with a `musicbrainz_trackid` moves its track off the composite key onto the MBID
 * one — orphaning the very overlay the fallback key existed to protect. Given the sources of a
 * freshly loaded album/playlist, this carries such an overlay onto the new key and returns how many
 * were moved.
 *
 * An overlay already stored under the MBID key blocks the move, and so does a second track in the
 * list contending for either key: the rows stay untouched, because deciding between two annotations
 * of one track is a repair screen, not a side effect of opening a list.
 *
 * Contention is counted among the tracks that could actually move, so a track already blocked by an
 * overlay under its own MBID key does not count as a contender for the composite one — two copies
 * of a file where only one is still unannotated do get their single overlay moved, deliberately.
 */
export async function rekeyOverlays(sources: OverlayKeySource[]): Promise<number> {
  const candidates = sources
    .filter(source => !!source.musicBrainzId)
    .map(source => ({
      musicBrainzId: source.musicBrainzId,
      mbidKey: deriveOverlayKey(source),
      compositeKey: deriveOverlayKey({ ...source, musicBrainzId: undefined }),
    }))

  if (candidates.length === 0)
    return 0

  const existing = await getOverlaysByKeys(candidates.flatMap(c => [c.mbidKey, c.compositeKey]))
  const movable = candidates.filter(c => existing.has(c.compositeKey) && !existing.has(c.mbidKey))

  // One list can name a key twice: two tagged copies of one file share a composite key (see the
  // duplicate-key decision in the plan), and two entries of one recording share an MBID. Either way
  // two annotations contend for one key — the same situation the rule above leaves alone, so every
  // contending overlay stays put and the outcome does not depend on the order of the list.
  const compositesPerMbid = new Map<string, Set<string>>()
  const mbidsPerComposite = new Map<string, Set<string>>()
  for (const { mbidKey, compositeKey } of movable) {
    const composites = compositesPerMbid.get(mbidKey) ?? new Set<string>()
    composites.add(compositeKey)
    compositesPerMbid.set(mbidKey, composites)

    const mbids = mbidsPerComposite.get(compositeKey) ?? new Set<string>()
    mbids.add(mbidKey)
    mbidsPerComposite.set(compositeKey, mbids)
  }

  const moves: Array<{ row: TrackOverlay, from: string }> = []
  const moved = new Set<string>()

  for (const { musicBrainzId, mbidKey, compositeKey } of movable) {
    if (compositesPerMbid.get(mbidKey)!.size > 1 || mbidsPerComposite.get(compositeKey)!.size > 1)
      continue
    if (moved.has(mbidKey))
      continue
    moved.add(mbidKey)
    // Without the identifier the row would export an empty MBID cell and fall straight back onto
    // the composite key on the next import.
    moves.push({
      row: { ...existing.get(compositeKey)!, id: mbidKey, musicBrainzId, updatedAt: Date.now() },
      from: compositeKey,
    })
  }

  if (moves.length === 0)
    return 0

  await db.transaction('rw', db.trackOverlays, async () => {
    await db.trackOverlays.bulkPut(moves.map(m => m.row))
    await db.trackOverlays.bulkDelete(moves.map(m => m.from))
  })

  return moves.length
}

export async function getAllOverlays(): Promise<TrackOverlay[]> {
  return db.trackOverlays.toArray()
}

/**
 * Every `customFields` key some overlay carries, whether or not the registry knows it: a CSV column
 * writes values without ever registering a name, so the registry alone does not list the fields a
 * category predicate can read. Casing is kept as written — `parseOverlayCSV` preserves the header's
 * case, so `Popularity` and `popularity` are different fields and folding them would suggest a
 * spelling that matches nothing.
 */
export async function listCustomFieldNames(): Promise<string[]> {
  const names = new Set<string>()
  // `each` rather than `toArray`: only the keys are wanted, and the table has a row per track.
  await db.trackOverlays.each((overlay) => {
    for (const name of Object.keys(overlay.customFields))
      names.add(name)
  })
  return [...names]
}

// Overlay field registry — the dictionary of field names a category predicate may read. It only
// names and types fields; the values themselves live in each track's `customFields`.

export async function listOverlayFields(): Promise<OverlayField[]> {
  return db.overlayFields.orderBy('name').toArray()
}

export async function upsertOverlayField(name: string, type: OverlayField['type']): Promise<void> {
  const existing = await db.overlayFields.get(name)
  await db.overlayFields.put({ name, type, createdAt: existing?.createdAt ?? Date.now() })
}

/**
 * Values already written into `customFields` are left alone — the registry is a dictionary, not the
 * owner of the data, so removing an entry only stops suggesting the name.
 */
export async function deleteOverlayField(name: string): Promise<void> {
  await db.overlayFields.delete(name)
}
