import type { FrozenNavidromeTrack } from '@/services/navidromeGameSource'
import { describe, expect, it } from 'vitest'
import { describeFrozenTrack, findFrozenTracks } from '../frozenTrackSearch'

function makeFrozenTrack(overrides: Partial<FrozenNavidromeTrack> = {}): FrozenNavidromeTrack {
  return {
    id: 'song-1',
    overlayKey: 'key-1',
    title: 'Song One',
    playbackRange: null,
    fields: {},
    ...overrides,
  }
}

const pool: FrozenNavidromeTrack[] = [
  makeFrozenTrack({ id: 'abc123', overlayKey: 'mbid-aaa', title: 'Wonderwall', artist: 'Oasis', albumName: 'Morning Glory' }),
  makeFrozenTrack({ id: 'def456', overlayKey: 'mbid-bbb', title: 'Wonderwall (Live)', artist: 'Oasis' }),
  makeFrozenTrack({ id: 'ghi789', overlayKey: 'mbid-ccc', title: 'Champagne Supernova' }),
]

describe('findFrozenTracks', () => {
  it('resolves an exact song id to that single track', () => {
    expect(findFrozenTracks(pool, 'def456').map(t => t.id)).toEqual(['def456'])
  })

  it('resolves an exact overlay key (MusicBrainz id) to that single track', () => {
    expect(findFrozenTracks(pool, 'mbid-ccc').map(t => t.id)).toEqual(['ghi789'])
  })

  it('matches ids and titles case-insensitively', () => {
    expect(findFrozenTracks(pool, 'ABC123').map(t => t.id)).toEqual(['abc123'])
    expect(findFrozenTracks(pool, 'MBID-AAA').map(t => t.id)).toEqual(['abc123'])
    expect(findFrozenTracks(pool, 'wonderWALL').map(t => t.id)).toEqual(['abc123', 'def456'])
  })

  it('returns every track whose title contains the input', () => {
    expect(findFrozenTracks(pool, 'Wonderwall').map(t => t.id)).toEqual(['abc123', 'def456'])
  })

  it('returns nothing when neither an id nor a title matches', () => {
    expect(findFrozenTracks(pool, 'Live Forever')).toEqual([])
  })

  it('returns nothing for blank input instead of the whole pool', () => {
    expect(findFrozenTracks(pool, '   ')).toEqual([])
  })

  it('reports both tracks when two share an overlay key', () => {
    const duplicatePool: FrozenNavidromeTrack[] = [
      makeFrozenTrack({ id: 'rip-a', overlayKey: 'mbid-shared', title: 'Live Forever' }),
      makeFrozenTrack({ id: 'rip-b', overlayKey: 'mbid-shared', title: 'Live Forever (Remaster)' }),
    ]

    expect(findFrozenTracks(duplicatePool, 'mbid-shared').map(t => t.id)).toEqual(['rip-a', 'rip-b'])
  })

  it('does not dilute an exact id hit with tracks whose title contains the same string', () => {
    const collidingPool: FrozenNavidromeTrack[] = [
      makeFrozenTrack({ id: 'supernova', overlayKey: 'mbid-1', title: 'Champagne Supernova' }),
      makeFrozenTrack({ id: 'other', overlayKey: 'mbid-2', title: 'Supernova Reprise' }),
    ]

    expect(findFrozenTracks(collidingPool, 'supernova').map(t => t.id)).toEqual(['supernova'])
  })
})

describe('describeFrozenTrack', () => {
  it('joins title, artist and album', () => {
    expect(describeFrozenTrack(pool[0])).toBe('Wonderwall — Oasis — Morning Glory')
  })

  it('skips the album when it is missing', () => {
    expect(describeFrozenTrack(pool[1])).toBe('Wonderwall (Live) — Oasis')
  })

  it('falls back to the title alone when artist and album are missing', () => {
    expect(describeFrozenTrack(pool[2])).toBe('Champagne Supernova')
  })
})
