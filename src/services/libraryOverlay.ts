import type { TrackOverlay } from '@/db/schemas'
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
