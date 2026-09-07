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
      key: 'mbid-1',
      identity: {
        musicBrainzId: 'mbid-1',
        albumId: 'album-1',
        discNumber: 1,
        track: 3,
        title: 'A Track',
      },
      artist: 'An Artist',
      playbackRange: { startMs: 10000, endMs: 20000 },
      previewImageUrl: 'https://example.com/preview.png',
      enabled: true,
      customFields: {},
    })
  })

  it('round-trips an overlay without a musicBrainzId under its composite key', () => {
    const overlay = makeOverlay({ id: 'album-1|1|3|A Track', musicBrainzId: undefined })
    const csv = serializeOverlayCSV([overlay])
    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      key: overlay.id,
      identity: {
        albumId: 'album-1',
        discNumber: 1,
        track: 3,
        title: 'A Track',
      },
      artist: 'An Artist',
      playbackRange: { startMs: 10000, endMs: 20000 },
      previewImageUrl: 'https://example.com/preview.png',
      enabled: true,
      customFields: {},
    })
  })

  it('round-trips an overlay with no musicBrainzId, discNumber or track, keeping the empty key segments', () => {
    // Export writes empty cells for the missing numbers and `Number('')` is 0, so a naive parse
    // would turn `album-1|||A Track` into `album-1|0|0|A Track` and orphan the overlay on re-import.
    const overlay = makeOverlay({
      id: 'album-1|||A Track',
      musicBrainzId: undefined,
      discNumber: undefined,
      track: undefined,
    })
    const csv = serializeOverlayCSV([overlay])
    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([])
    expect(rows[0].key).toBe('album-1|||A Track')
    expect(rows[0].identity.discNumber).toBeUndefined()
    expect(rows[0].identity.track).toBeUndefined()
  })

  it('round-trips a title and albumId with surrounding whitespace under the very same key', () => {
    // Navidrome hands over whatever the tag says and `deriveOverlayKey` does not trim, so the key
    // stored in `trackOverlays` carries the whitespace — trimming on import would derive a
    // different key and quietly create a second, orphaned overlay.
    const overlay = makeOverlay({
      id: 'album-1 |1|3|A Track ',
      musicBrainzId: undefined,
      albumId: 'album-1 ',
      title: 'A Track ',
    })
    const csv = serializeOverlayCSV([overlay])
    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([])
    expect(rows[0].key).toBe(overlay.id)
    expect(rows[0].identity.albumId).toBe('album-1 ')
    expect(rows[0].identity.title).toBe('A Track ')
  })

  it('reports an unmapped row with a trimmed title, since that one is read by a human', () => {
    const csv = [
      'title,artist',
      '  Track One  ,Artist One',
    ].join('\n')

    const { unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([{ rowIndex: 1, title: 'Track One' }])
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

    expect(rows.find(r => r.identity.musicBrainzId === 'a')?.customFields).toEqual({ Popularity: '10' })
    expect(rows.find(r => r.identity.musicBrainzId === 'b')?.customFields).toEqual({})
  })

  it('keys a row without musicBrainzId by albumId/discNumber/track/title, unmapping only rows with no key at all', () => {
    const csv = [
      'musicBrainzId,albumId,discNumber,track,title,artist,playbackRange,previewImageUrl,enabled',
      ',album-1,1,2,No MBID Track,Someone,0:10-0:20,https://x/y.png,true',
      ',,,,Nothing To Key By,Nobody,,,',
      'mbid-2,album-2,,,Has MBID Track,Someone Else,,,',
    ].join('\n')

    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([{ rowIndex: 2, title: 'Nothing To Key By' }])
    expect(rows.map(r => r.key)).toEqual(['album-1|1|2|No MBID Track', 'mbid-2'])
    expect(rows[0].playbackRange).toEqual({ startMs: 10000, endMs: 20000 })
  })

  it('prefers musicBrainzId over the composite key when a row carries both', () => {
    const csv = [
      'musicBrainzId,albumId,discNumber,track,title',
      'mbid-1,album-1,1,2,Some Track',
    ].join('\n')

    const { rows } = parseOverlayCSV(csv)

    expect(rows[0].key).toBe('mbid-1')
    expect(rows[0].identity.albumId).toBe('album-1')
  })

  it('builds a key with empty segments when the discNumber and track cells are empty', () => {
    // 71/71 tracks without an MBID, a disc and a track number still have a unique key (see plan).
    const csv = [
      'musicBrainzId,albumId,discNumber,track,title',
      ',album-1,,,Some Track',
    ].join('\n')

    const { rows } = parseOverlayCSV(csv)

    expect(rows[0].key).toBe('album-1|||Some Track')
    expect(rows[0].identity.discNumber).toBeUndefined()
    expect(rows[0].identity.track).toBeUndefined()
  })

  it('keys a row carrying only a musicBrainzId, with no title column at all', () => {
    const csv = [
      'musicBrainzId,playbackRange',
      'mbid-9,0:05-0:10',
    ].join('\n')

    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([])
    expect(rows[0].key).toBe('mbid-9')
    expect(rows[0].identity).toEqual({ musicBrainzId: 'mbid-9' })
  })

  it('unmaps a row that has no musicBrainzId and an incomplete composite key', () => {
    const csv = [
      'musicBrainzId,albumId,discNumber,track,title',
      ',,,,Title Without Album',
      ',album-1,1,2,',
      ',album-2,,,Keyed Track',
    ].join('\n')

    const { rows, unmapped } = parseOverlayCSV(csv)

    expect(unmapped).toEqual([
      { rowIndex: 1, title: 'Title Without Album' },
      { rowIndex: 2, title: undefined },
    ])
    expect(rows.map(r => r.key)).toEqual(['album-2|||Keyed Track'])
  })

  it('reports unmapped rows with correct rowIndex when both key columns are missing entirely', () => {
    // Someone else's sheet: neither musicBrainzId nor albumId, so no key can be derived at all.
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
    { id: 's1', title: 'First', musicBrainzId: 'mbid-a', albumId: 'album-1', discNumber: 1, track: 1 },
    { id: 's2', title: 'Second', albumId: 'album-2', discNumber: 1, track: 4 },
  ]

  it('emits the identity columns in export order, 1-based index matching input order', () => {
    const csv = serializeTrackIdentityCSV(songs)
    const lines = csv.trim().split(/\r\n|\n/)

    expect(lines[0]).toBe('index,musicBrainzId,albumId,discNumber,track,title')
    expect(lines[1]).toBe('1,mbid-a,album-1,1,1,First')
    // A song without an MBID still gets a fallback identity, not just an empty cell and a title.
    expect(lines[2]).toBe('2,,album-2,1,4,Second')
  })

  it('leaves a cell empty for every identity field the song does not have', () => {
    const csv = serializeTrackIdentityCSV([{ id: 's3', title: 'Third' }])
    const lines = csv.trim().split(/\r\n|\n/)

    expect(lines[1]).toBe('1,,,,,Third')
  })
})
