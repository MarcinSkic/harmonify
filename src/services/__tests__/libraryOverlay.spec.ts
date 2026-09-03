import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { LibraryOverlayService } from '../.'

beforeEach(async () => {
  await db.trackOverlays.clear()
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
