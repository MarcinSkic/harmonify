import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { LibraryOverlayService } from '../.'

const PREVIEW_URL = 'https://example.com/cover.jpg'

beforeEach(async () => {
  await db.trackOverlays.clear()
  await db.linkPreviews.clear()
  // `upsertOverlay` queues a preview fetch and drains the queue without awaiting it; a promise that
  // never settles parks that drain on `fetch` instead of letting it touch the network or race an
  // assertion.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

describe('upsertOverlay', () => {
  it('creates a new overlay keyed by deriveOverlayKey', async () => {
    await LibraryOverlayService.upsertOverlay(
      { musicBrainzId: 'mbid-1', title: 'Track' },
      { enabled: false },
    )

    const overlay = await LibraryOverlayService.getOverlay('mbid-1')
    expect(overlay).toBeDefined()
    expect(overlay!.enabled).toBe(false)
    expect(overlay!.title).toBe('Track')
    expect(overlay!.customFields).toEqual({})
  })

  it('merges a patch into an existing overlay instead of replacing it', async () => {
    await LibraryOverlayService.upsertOverlay(
      { musicBrainzId: 'mbid-1', title: 'Track' },
      { playbackRange: { startMs: 1000, endMs: 2000 } },
    )
    await LibraryOverlayService.upsertOverlay(
      { musicBrainzId: 'mbid-1', title: 'Track' },
      { enabled: false },
    )

    const overlay = await LibraryOverlayService.getOverlay('mbid-1')
    expect(overlay!.playbackRange).toEqual({ startMs: 1000, endMs: 2000 })
    expect(overlay!.enabled).toBe(false)
  })

  it('queues a preview fetch for a saved previewImageUrl', async () => {
    await LibraryOverlayService.upsertOverlay(
      { musicBrainzId: 'mbid-1', title: 'Track' },
      { previewImageUrl: PREVIEW_URL },
    )

    const record = await db.linkPreviews.get(PREVIEW_URL)
    expect(record).toBeDefined()
    expect(record!.status).toBe('pending')
  })

  it('queues the preview of an existing overlay when only enabled is toggled', async () => {
    await LibraryOverlayService.upsertOverlay(
      { musicBrainzId: 'mbid-1', title: 'Track' },
      { previewImageUrl: PREVIEW_URL },
    )
    await db.linkPreviews.clear()

    await LibraryOverlayService.upsertOverlay(
      { musicBrainzId: 'mbid-1', title: 'Track' },
      { enabled: false },
    )

    const record = await db.linkPreviews.get(PREVIEW_URL)
    expect(record).toBeDefined()
    expect(record!.status).toBe('pending')
  })

  it('falls back to the composite key when musicBrainzId is missing', async () => {
    await LibraryOverlayService.upsertOverlay(
      { albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' },
      { enabled: false },
    )

    const overlay = await LibraryOverlayService.getOverlay('album-1|1|2|Track')
    expect(overlay).toBeDefined()
  })
})

describe('setCustomField / removeCustomField', () => {
  it('adds a custom field to a new overlay', async () => {
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-1', title: 'Track' }, 'Popularity', '42')

    const overlay = await LibraryOverlayService.getOverlay('mbid-1')
    expect(overlay!.customFields).toEqual({ Popularity: '42' })
  })

  it('merges an additional custom field without dropping existing ones', async () => {
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-1', title: 'Track' }, 'Popularity', '42')
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-1', title: 'Track' }, 'Mood', 'Chill')

    const overlay = await LibraryOverlayService.getOverlay('mbid-1')
    expect(overlay!.customFields).toEqual({ Popularity: '42', Mood: 'Chill' })
  })

  it('removes a single custom field, leaving the rest intact', async () => {
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-1', title: 'Track' }, 'Popularity', '42')
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-1', title: 'Track' }, 'Mood', 'Chill')

    await LibraryOverlayService.removeCustomField('mbid-1', 'Popularity')

    const overlay = await LibraryOverlayService.getOverlay('mbid-1')
    expect(overlay!.customFields).toEqual({ Mood: 'Chill' })
  })

  it('does nothing when removing a custom field from a nonexistent overlay', async () => {
    await expect(LibraryOverlayService.removeCustomField('nonexistent', 'Popularity')).resolves.toBeUndefined()
  })
})

describe('getOverlaysByKeys / getAllOverlays', () => {
  it('bulk-fetches only the overlays that exist among the given keys', async () => {
    await LibraryOverlayService.upsertOverlay({ musicBrainzId: 'mbid-1', title: 'A' }, {})
    await LibraryOverlayService.upsertOverlay({ musicBrainzId: 'mbid-2', title: 'B' }, {})

    const overlays = await LibraryOverlayService.getOverlaysByKeys(['mbid-1', 'mbid-2', 'mbid-missing'])

    expect(overlays.size).toBe(2)
    expect(overlays.get('mbid-1')?.title).toBe('A')
    expect(overlays.get('mbid-missing')).toBeUndefined()
  })

  it('returns all overlays for export', async () => {
    await LibraryOverlayService.upsertOverlay({ musicBrainzId: 'mbid-1', title: 'A' }, {})
    await LibraryOverlayService.upsertOverlay({ musicBrainzId: 'mbid-2', title: 'B' }, {})

    const overlays = await LibraryOverlayService.getAllOverlays()
    expect(overlays).toHaveLength(2)
  })
})

describe('rekeyOverlays', () => {
  const taggedSong = { musicBrainzId: 'mbid-1', albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' }

  it('moves an overlay off the composite key once the track gained a musicBrainzId', async () => {
    await LibraryOverlayService.upsertOverlay(
      { albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' },
      { playbackRange: { startMs: 1000, endMs: 2000 } },
    )

    expect(await LibraryOverlayService.rekeyOverlays([taggedSong])).toBe(1)

    const moved = await LibraryOverlayService.getOverlay('mbid-1')
    expect(moved!.id).toBe('mbid-1')
    // Without this the row would export an empty MBID cell and fall back to the composite key.
    expect(moved!.musicBrainzId).toBe('mbid-1')
    expect(moved!.playbackRange).toEqual({ startMs: 1000, endMs: 2000 })
    expect(await LibraryOverlayService.getOverlay('album-1|1|2|Track')).toBeUndefined()
  })

  it('leaves both overlays untouched when one exists under each key', async () => {
    await LibraryOverlayService.upsertOverlay(
      { albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' },
      { playbackRange: { startMs: 1000, endMs: 2000 } },
    )
    await LibraryOverlayService.upsertOverlay(taggedSong, { playbackRange: { startMs: 3000, endMs: 4000 } })

    expect(await LibraryOverlayService.rekeyOverlays([taggedSong])).toBe(0)

    const byMbid = await LibraryOverlayService.getOverlay('mbid-1')
    const byComposite = await LibraryOverlayService.getOverlay('album-1|1|2|Track')
    expect(byMbid!.playbackRange).toEqual({ startMs: 3000, endMs: 4000 })
    expect(byComposite!.playbackRange).toEqual({ startMs: 1000, endMs: 2000 })
  })

  it('does nothing for a track without a musicBrainzId', async () => {
    await LibraryOverlayService.upsertOverlay(
      { albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' },
      { enabled: false },
    )

    expect(await LibraryOverlayService.rekeyOverlays([{ albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' }])).toBe(0)
    expect(await LibraryOverlayService.getOverlay('album-1|1|2|Track')).toBeDefined()
  })

  it('leaves the overlay alone when two tagged tracks share its composite key', async () => {
    // The duplicate-file case: one recording in two files, each now tagged with its own MBID. There
    // is no telling which of them the single annotation belongs to, so it moves onto neither.
    await LibraryOverlayService.upsertOverlay(
      { albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' },
      { enabled: false },
    )

    const moved = await LibraryOverlayService.rekeyOverlays([
      taggedSong,
      { ...taggedSong, musicBrainzId: 'mbid-2' },
    ])

    expect(moved).toBe(0)
    expect(await LibraryOverlayService.getOverlay('album-1|1|2|Track')).toBeDefined()
    expect(await LibraryOverlayService.getOverlay('mbid-1')).toBeUndefined()
    expect(await LibraryOverlayService.getOverlay('mbid-2')).toBeUndefined()
  })

  it('leaves both overlays alone when two tracks sharing a musicBrainzId each have one', async () => {
    await LibraryOverlayService.upsertOverlay({ albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' }, {})
    await LibraryOverlayService.upsertOverlay({ albumId: 'album-1', discNumber: 1, track: 5, title: 'Other' }, {})

    const sources = [taggedSong, { ...taggedSong, track: 5, title: 'Other' }]

    // Whichever moved would silently overwrite the other under `mbid-1`, and which one that is must
    // not come down to the order of the track list.
    expect(await LibraryOverlayService.rekeyOverlays(sources)).toBe(0)
    expect(await LibraryOverlayService.rekeyOverlays([...sources].reverse())).toBe(0)
    expect(await LibraryOverlayService.getOverlay('album-1|1|2|Track')).toBeDefined()
    expect(await LibraryOverlayService.getOverlay('album-1|1|5|Other')).toBeDefined()
  })

  it('moves once when the same track appears twice in one list', async () => {
    await LibraryOverlayService.upsertOverlay(
      { albumId: 'album-1', discNumber: 1, track: 2, title: 'Track' },
      { enabled: false },
    )

    expect(await LibraryOverlayService.rekeyOverlays([taggedSong, { ...taggedSong }])).toBe(1)
    expect(await LibraryOverlayService.getOverlay('mbid-1')).toBeDefined()
  })
})

describe('listCustomFieldNames', () => {
  it('collects the field names an import wrote without registering them', async () => {
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-1', title: 'A' }, 'popularity', '3')
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-2', title: 'B' }, 'popularity', '5')
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-2', title: 'B' }, 'decade', '2020')

    const names = await LibraryOverlayService.listCustomFieldNames()

    expect([...names].sort()).toEqual(['decade', 'popularity'])
  })

  it('keeps names that differ only in case apart', async () => {
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-1', title: 'A' }, 'Popularity', '3')
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-2', title: 'B' }, 'popularity', '5')

    const names = await LibraryOverlayService.listCustomFieldNames()

    expect([...names].sort()).toEqual(['Popularity', 'popularity'])
  })

  it('returns nothing when no overlay carries a custom field', async () => {
    await LibraryOverlayService.upsertOverlay({ musicBrainzId: 'mbid-1', title: 'A' }, {})

    expect(await LibraryOverlayService.listCustomFieldNames()).toEqual([])
  })
})
