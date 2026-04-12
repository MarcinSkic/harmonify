import type { Category, Track } from '@/db/schemas'
import { describe, expect, it } from 'vitest'
import {
  createCategoryPool,
  getCategoryCounts,
  isCategoryPoolExhausted,
  pickFromCategory,
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

function makeCategory(id: string, tagFilter: string[], order: number): Category {
  return {
    id,
    tagFilter,
    displayName: id,
    order,
    enabled: true,
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

  const rockCategory = makeCategory('cat-rock', ['rock'], 0)
  const popCategory = makeCategory('cat-pop', ['pop'], 1)
  const jazzCategory = makeCategory('cat-jazz', ['jazz'], 2)
  const categories = [rockCategory, popCategory, jazzCategory]

  describe('createCategoryPool', () => {
    it('groups tracks by category using tagFilter', () => {
      const pool = createCategoryPool(tracks, categories)

      expect(pool.categoryPools[rockCategory.id]).toEqual(
        expect.arrayContaining(['t1', 't2']),
      )
      expect(pool.categoryPools[rockCategory.id]).toHaveLength(2)
      expect(pool.categoryPools[popCategory.id]).toEqual(
        expect.arrayContaining(['t2', 't3']),
      )
      expect(pool.categoryPools[popCategory.id]).toHaveLength(2)
      expect(pool.categoryPools[jazzCategory.id]).toEqual(['t4'])
      expect(pool.playedTrackIds).toHaveLength(0)
    })

    it('supports categories that union multiple tags', () => {
      const ostCategory = makeCategory('cat-ost', ['rock', 'jazz'], 0)
      const pool = createCategoryPool(tracks, [ostCategory])

      expect(pool.categoryPools[ostCategory.id]).toEqual(
        expect.arrayContaining(['t1', 't2', 't4']),
      )
      expect(pool.categoryPools[ostCategory.id]).toHaveLength(3)
    })

    it('excludes tracks without matching tags', () => {
      const pool = createCategoryPool(tracks, categories)
      const allIds = Object.values(pool.categoryPools).flat()

      expect(allIds).not.toContain('t5')
    })

    it('creates empty pool for category with no matching tracks', () => {
      const orphanCategory = makeCategory('cat-orphan', ['metal'], 0)
      const pool = createCategoryPool(tracks, [orphanCategory])

      expect(pool.categoryPools[orphanCategory.id]).toEqual([])
    })

    it('handles empty tracks array', () => {
      const pool = createCategoryPool([], categories)

      expect(pool.categoryPools[rockCategory.id]).toEqual([])
      expect(pool.categoryPools[popCategory.id]).toEqual([])
      expect(pool.categoryPools[jazzCategory.id]).toEqual([])
      expect(pool.playedTrackIds).toHaveLength(0)
    })

    it('handles empty categories array', () => {
      const pool = createCategoryPool(tracks, [])

      expect(pool.categoryPools).toEqual({})
      expect(pool.playedTrackIds).toHaveLength(0)
    })
  })

  describe('pickFromCategory', () => {
    it('picks a track from the given category', () => {
      const pool = createCategoryPool(tracks, categories)
      const { trackId, newState } = pickFromCategory(pool, jazzCategory.id)

      expect(trackId).toBe('t4')
      expect(newState.playedTrackIds).toEqual(['t4'])
      expect(newState.categoryPools[jazzCategory.id]).toHaveLength(0)
    })

    it('removes the picked track from ALL categories it belonged to', () => {
      const pool = createCategoryPool(tracks, categories)
      // t2 has tags [rock, pop], so it's in both rockCategory and popCategory.
      // Force-pick by deterministic ordering.
      const forcedState = {
        ...pool,
        categoryPools: {
          ...pool.categoryPools,
          [rockCategory.id]: ['t2', 't1'],
          [popCategory.id]: ['t2', 't3'],
        },
      }
      const { trackId, newState } = pickFromCategory(forcedState, rockCategory.id)

      expect(trackId).toBe('t2')
      expect(newState.categoryPools[rockCategory.id]).toEqual(['t1'])
      expect(newState.categoryPools[popCategory.id]).toEqual(['t3'])
    })

    it('keeps empty categories in the map (for UI display)', () => {
      const soloCategory = makeCategory('cat-solo', ['solo'], 0)
      const pool = createCategoryPool(
        [makeTrack('only', ['solo'])],
        [soloCategory],
      )
      const { newState } = pickFromCategory(pool, soloCategory.id)

      expect(newState.categoryPools[soloCategory.id]).toEqual([])
      expect(soloCategory.id in newState.categoryPools).toBe(true)
    })

    it('does not mutate the original state', () => {
      const pool = createCategoryPool(tracks, categories)
      const originalJazz = [...pool.categoryPools[jazzCategory.id]]

      pickFromCategory(pool, jazzCategory.id)

      expect(pool.categoryPools[jazzCategory.id]).toEqual(originalJazz)
      expect(pool.playedTrackIds).toHaveLength(0)
    })

    it('throws when the category is empty', () => {
      const soloCategory = makeCategory('cat-solo', ['solo'], 0)
      const pool = createCategoryPool(
        [makeTrack('only', ['solo'])],
        [soloCategory],
      )
      const drained = pickFromCategory(pool, soloCategory.id).newState

      expect(() => pickFromCategory(drained, soloCategory.id)).toThrow('exhausted')
    })

    it('throws when the category does not exist', () => {
      const pool = createCategoryPool(tracks, categories)

      expect(() => pickFromCategory(pool, 'nonexistent')).toThrow('exhausted')
    })
  })

  describe('getCategoryCounts', () => {
    it('returns counts keyed by categoryId', () => {
      const pool = createCategoryPool(tracks, categories)
      const counts = getCategoryCounts(pool)

      expect(counts).toEqual({
        [rockCategory.id]: 2,
        [popCategory.id]: 2,
        [jazzCategory.id]: 1,
      })
    })

    it('includes exhausted categories with count 0', () => {
      const soloCategory = makeCategory('cat-solo', ['solo'], 0)
      const pool = createCategoryPool(
        [makeTrack('only', ['solo'])],
        [soloCategory],
      )
      const drained = pickFromCategory(pool, soloCategory.id).newState
      const counts = getCategoryCounts(drained)

      expect(counts).toEqual({ [soloCategory.id]: 0 })
    })
  })

  describe('isCategoryPoolExhausted', () => {
    it('returns false when any category has tracks', () => {
      const pool = createCategoryPool(tracks, categories)

      expect(isCategoryPoolExhausted(pool)).toBe(false)
    })

    it('returns true when all categories are empty', () => {
      const soloCategory = makeCategory('cat-solo', ['solo'], 0)
      const pool = createCategoryPool(
        [makeTrack('only', ['solo'])],
        [soloCategory],
      )
      const drained = pickFromCategory(pool, soloCategory.id).newState

      expect(isCategoryPoolExhausted(drained)).toBe(true)
    })

    it('returns true for an empty pool', () => {
      const pool = createCategoryPool([], categories)

      expect(isCategoryPoolExhausted(pool)).toBe(true)
    })

    it('returns true when the last multi-category track is played', () => {
      // One track in two categories — playing from either drains both.
      const catA = makeCategory('cat-a', ['x'], 0)
      const catB = makeCategory('cat-b', ['x'], 1)
      const pool = createCategoryPool([makeTrack('a', ['x'])], [catA, catB])
      const drained = pickFromCategory(pool, catA.id).newState

      expect(isCategoryPoolExhausted(drained)).toBe(true)
      expect(drained.categoryPools[catB.id]).toEqual([])
    })
  })
})
