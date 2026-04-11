import type { Track } from '@/db/schemas'
import { describe, expect, it } from 'vitest'
import {
  createCategoryPool,
  getAllCategories,
  isCategoryPoolExhausted,
  pickFromTag,
} from '../categoryPool'

function makeTrack(id: string, tags: string[]): Track {
  return {
    id,
    sourceId: id,
    name: `Track ${id}`,
    artists: ['Artist'],
    albumName: 'Album',
    durationMs: 1000,
    audioUrl: `https://example.com/${id}`,
    playbackRange: null,
    tags,
    playlistIds: [],
    metadataSource: 'manual',
    createdAt: 0,
  }
}

describe('categoryPool', () => {
  const tracks: Track[] = [
    makeTrack('t1', ['rock']),
    makeTrack('t2', ['rock', 'pop']),
    makeTrack('t3', ['pop']),
    makeTrack('t4', ['jazz']),
    makeTrack('t5', []), // untagged, should be excluded
  ]

  describe('createCategoryPool', () => {
    it('groups tracks by tag', () => {
      const pool = createCategoryPool(tracks)

      expect(pool.tagPools.rock).toEqual(expect.arrayContaining(['t1', 't2']))
      expect(pool.tagPools.rock).toHaveLength(2)
      expect(pool.tagPools.pop).toEqual(expect.arrayContaining(['t2', 't3']))
      expect(pool.tagPools.pop).toHaveLength(2)
      expect(pool.tagPools.jazz).toEqual(['t4'])
      expect(pool.playedTrackIds).toHaveLength(0)
    })

    it('excludes tracks without tags', () => {
      const pool = createCategoryPool(tracks)
      const allIds = Object.values(pool.tagPools).flat()

      expect(allIds).not.toContain('t5')
    })

    it('handles empty tracks array', () => {
      const pool = createCategoryPool([])

      expect(pool.tagPools).toEqual({})
      expect(pool.playedTrackIds).toHaveLength(0)
    })
  })

  describe('pickFromTag', () => {
    it('picks a track from the given tag', () => {
      const pool = createCategoryPool(tracks)
      const { trackId, newState } = pickFromTag(pool, 'jazz')

      expect(trackId).toBe('t4')
      expect(newState.playedTrackIds).toEqual(['t4'])
      expect(newState.tagPools.jazz).toHaveLength(0)
    })

    it('removes the picked track from ALL tags it belonged to', () => {
      const pool = createCategoryPool(tracks)
      // t2 has tags [rock, pop]. Force-pick it from rock.
      // Since order is shuffled, we manipulate: find a state where t2 is first in rock.
      const forcedState = {
        ...pool,
        tagPools: {
          ...pool.tagPools,
          rock: ['t2', 't1'],
          pop: ['t2', 't3'],
        },
      }
      const { trackId, newState } = pickFromTag(forcedState, 'rock')

      expect(trackId).toBe('t2')
      expect(newState.tagPools.rock).toEqual(['t1'])
      expect(newState.tagPools.pop).toEqual(['t3'])
    })

    it('keeps empty tags in the map (for UI display)', () => {
      const pool = createCategoryPool([makeTrack('only', ['solo'])])
      const { newState } = pickFromTag(pool, 'solo')

      expect(newState.tagPools.solo).toEqual([])
      expect('solo' in newState.tagPools).toBe(true)
    })

    it('does not mutate the original state', () => {
      const pool = createCategoryPool(tracks)
      const originalJazz = [...pool.tagPools.jazz]

      pickFromTag(pool, 'jazz')

      expect(pool.tagPools.jazz).toEqual(originalJazz)
      expect(pool.playedTrackIds).toHaveLength(0)
    })

    it('throws when the tag is empty', () => {
      const pool = createCategoryPool([makeTrack('only', ['solo'])])
      const drained = pickFromTag(pool, 'solo').newState

      expect(() => pickFromTag(drained, 'solo')).toThrow('exhausted')
    })

    it('throws when the tag does not exist', () => {
      const pool = createCategoryPool(tracks)

      expect(() => pickFromTag(pool, 'nonexistent')).toThrow('exhausted')
    })
  })

  describe('getAllCategories', () => {
    it('returns all tags sorted by name with counts', () => {
      const pool = createCategoryPool(tracks)
      const cats = getAllCategories(pool)

      expect(cats).toEqual([
        { tag: 'jazz', count: 1 },
        { tag: 'pop', count: 2 },
        { tag: 'rock', count: 2 },
      ])
    })

    it('includes exhausted tags with count 0', () => {
      const pool = createCategoryPool([makeTrack('only', ['solo'])])
      const drained = pickFromTag(pool, 'solo').newState
      const cats = getAllCategories(drained)

      expect(cats).toEqual([{ tag: 'solo', count: 0 }])
    })
  })

  describe('isCategoryPoolExhausted', () => {
    it('returns false when any tag has tracks', () => {
      const pool = createCategoryPool(tracks)

      expect(isCategoryPoolExhausted(pool)).toBe(false)
    })

    it('returns true when all tags are empty', () => {
      const pool = createCategoryPool([makeTrack('only', ['solo'])])
      const drained = pickFromTag(pool, 'solo').newState

      expect(isCategoryPoolExhausted(drained)).toBe(true)
    })

    it('returns true for an empty pool', () => {
      const pool = createCategoryPool([])

      expect(isCategoryPoolExhausted(pool)).toBe(true)
    })

    it('returns true when the last multi-tag track is played', () => {
      // Two tracks, one shared tag; playing the multi-tag track from one tag
      // drains the other.
      const pool = createCategoryPool([
        makeTrack('a', ['x']),
      ])
      const drained = pickFromTag(pool, 'x').newState

      expect(isCategoryPoolExhausted(drained)).toBe(true)
    })
  })
})
