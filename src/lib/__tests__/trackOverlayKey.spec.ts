import { describe, expect, it } from 'vitest'
import { deriveOverlayKey } from '../trackOverlayKey'

describe('deriveOverlayKey', () => {
  it('uses musicBrainzId directly when present', () => {
    const key = deriveOverlayKey({
      musicBrainzId: 'mbid-123',
      albumId: 'album-1',
      discNumber: 1,
      track: 2,
      title: 'Some Title',
    })
    expect(key).toBe('mbid-123')
  })

  it('builds a composite key from albumId/discNumber/track/title when musicBrainzId is missing', () => {
    const key = deriveOverlayKey({
      albumId: 'album-1',
      discNumber: 1,
      track: 2,
      title: 'Some Title',
    })
    expect(key).toBe('album-1|1|2|Some Title')
  })

  it('produces empty segments for missing albumId/discNumber/track, keeping the key deterministic', () => {
    const key = deriveOverlayKey({ title: 'Only Title' })
    expect(key).toBe('|||Only Title')
  })

  it('returns the same key for the same input (deterministic)', () => {
    const source = { albumId: 'a', discNumber: 1, track: 3, title: 'T' }
    expect(deriveOverlayKey(source)).toBe(deriveOverlayKey({ ...source }))
  })

  it('treats an empty musicBrainzId as absent and falls back to the composite key', () => {
    const key = deriveOverlayKey({ musicBrainzId: '', albumId: 'album-1', discNumber: 1, track: 2, title: 'Some Title' })
    expect(key).toBe('album-1|1|2|Some Title')
  })
})
