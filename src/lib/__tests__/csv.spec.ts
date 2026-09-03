import type { TrackOverlay } from '@/db/schemas'
import type { SubsonicSong } from '@/services/navidrome'
import { describe, expect, it } from 'vitest'
import { parseOverlayCSV, serializeOverlayCSV, serializeTrackIdentityCSV } from '../csv'

function makeOverlay(overrides: Partial<TrackOverlay> = {}): TrackOverlay {
  return {
    id: 'mbid-1',
    musicBrainzId: 'mbid-1',
    albumId: 'album-1',
    discNumber: 1,
    track: 3,
    title: 'A Track',
    artist: 'An Artist',
    playbackRange: { startMs: 10000, endMs: 20000 },
    previewImageUrl: 'https://example.com/preview.png',
    enabled: true,
    customFields: {},
    updatedAt: 1,
    ...overrides,
  }
}

describe('parseOverlayCSV / serializeOverlayCSV round trip', () => {
  it('round-trips a row with no custom fields', () => {
    const overlay = makeOverlay()
    const csv = serializeOverlayCSV([overlay])
    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      musicBrainzId: 'mbid-1',
      artist: 'An Artist',
      playbackRange: { startMs: 10000, endMs: 20000 },
      previewImageUrl: 'https://example.com/preview.png',
      enabled: true,
      customFields: {},
    })
  })

  it('round-trips custom columns, preserving their original casing for both name and value', () => {
    const overlay = makeOverlay({
      customFields: { Popularity: '42', Priorytet: 'Wysoki' },
    })
    const csv = serializeOverlayCSV([overlay])

    expect(csv).toContain('Popularity')
    expect(csv).toContain('Priorytet')
    expect(csv).not.toContain('popularity')

    const { rows } = parseOverlayCSV(csv)
    expect(rows[0].customFields).toEqual({ Popularity: '42', Priorytet: 'Wysoki' })
  })

  it('fills a missing custom field with an empty cell for rows that lack it', () => {
    const csv = serializeOverlayCSV([
      makeOverlay({ id: 'a', musicBrainzId: 'a', customFields: { Popularity: '10' } }),
      makeOverlay({ id: 'b', musicBrainzId: 'b', customFields: {} }),
    ])
    const { rows } = parseOverlayCSV(csv)

    expect(rows.find(r => r.musicBrainzId === 'a')?.customFields).toEqual({ Popularity: '10' })
    expect(rows.find(r => r.musicBrainzId === 'b')?.customFields).toEqual({})
  })

  it('puts a row without musicBrainzId into unmapped, not rows, regardless of other fields', () => {
    const csv = [
      'musicBrainzId,title,artist,playbackRange,previewImageUrl,enabled',
      ',No MBID Track,Someone,0:10-0:20,https://x/y.png,true',
      'mbid-2,Has MBID Track,Someone Else,,,',
    ].join('\n')

    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([{ rowIndex: 1, title: 'No MBID Track' }])
    expect(rows).toHaveLength(1)
    expect(rows[0].musicBrainzId).toBe('mbid-2')
  })

  it('reports unmapped rows with correct rowIndex when the musicBrainzId column is missing entirely', () => {
    const csv = [
      'title,artist',
      'Track One,Artist One',
      'Track Two,Artist Two',
    ].join('\n')

    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(rows).toEqual([])
    expect(unmapped).toEqual([
      { rowIndex: 1, title: 'Track One' },
      { rowIndex: 2, title: 'Track Two' },
    ])
  })

  it('leaves playbackRange as undefined when the column is absent, so an import does not zero it out', () => {
    // A sheet built only to bulk-set a custom field (e.g. popularity), the exact case the
    // migration docs describe — it must not carry an implicit "clear playbackRange" instruction.
    const csv = [
      'musicBrainzId,title,popularity',
      'mbid-1,Some Track,8',
    ].join('\n')

    const { rows } = parseOverlayCSV(csv)

    expect(rows[0].playbackRange).toBeUndefined()
    expect(rows[0].customFields).toEqual({ popularity: '8' })
  })

  it('parses playbackRange as null (not undefined) when the column is present but the cell is empty', () => {
    const csv = [
      'musicBrainzId,title,playbackRange',
      'mbid-1,Some Track,',
    ].join('\n')

    const { rows } = parseOverlayCSV(csv)

    expect(rows[0].playbackRange).toBeNull()
  })
})

describe('serializeTrackIdentityCSV', () => {
  const songs: SubsonicSong[] = [
    { id: 's1', title: 'First', musicBrainzId: 'mbid-a' },
    { id: 's2', title: 'Second' },
  ]

  it('emits index/musicBrainzId/title columns, 1-based index matching input order', () => {
    const csv = serializeTrackIdentityCSV(songs)
    const lines = csv.trim().split(/\r\n|\n/)

    expect(lines[0]).toBe('index,musicBrainzId,title')
    expect(lines[1]).toBe('1,mbid-a,First')
    expect(lines[2]).toBe('2,,Second')
  })
})
