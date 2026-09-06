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
