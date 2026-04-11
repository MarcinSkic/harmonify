import { describe, expect, it } from 'vitest'
import { createPool, isExhausted, pickRandom } from '../trackPool'

describe('trackPool', () => {
  const trackIds = ['t1', 't2', 't3', 't4', 't5']

  describe('createPool', () => {
    it('should create a pool with all tracks available', () => {
      const pool = createPool(trackIds)

      expect(pool.availableTrackIds).toHaveLength(5)
      expect(pool.playedTrackIds).toHaveLength(0)
      expect(pool.availableTrackIds).toEqual(expect.arrayContaining(trackIds))
    })

    it('should handle an empty array', () => {
      const pool = createPool([])

      expect(pool.availableTrackIds).toHaveLength(0)
      expect(pool.playedTrackIds).toHaveLength(0)
    })
  })

  describe('pickRandom', () => {
    it('should pick a track and move it to played', () => {
      const pool = createPool(trackIds)
      const { trackId, newState } = pickRandom(pool)

      expect(trackIds).toContain(trackId)
      expect(newState.availableTrackIds).toHaveLength(4)
      expect(newState.playedTrackIds).toEqual([trackId])
      expect(newState.availableTrackIds).not.toContain(trackId)
    })

    it('should not mutate the original state', () => {
      const pool = createPool(trackIds)
      const originalAvailable = [...pool.availableTrackIds]

      pickRandom(pool)

      expect(pool.availableTrackIds).toEqual(originalAvailable)
      expect(pool.playedTrackIds).toHaveLength(0)
    })

    it('should exhaust all tracks after picking all', () => {
      let state = createPool(trackIds)
      const picked: string[] = []

      for (let i = 0; i < 5; i++) {
        const result = pickRandom(state)
        picked.push(result.trackId)
        state = result.newState
      }

      expect(picked).toHaveLength(5)
      expect(picked).toEqual(expect.arrayContaining(trackIds))
      expect(state.availableTrackIds).toHaveLength(0)
      expect(state.playedTrackIds).toHaveLength(5)
    })

    it('should throw when pool is exhausted', () => {
      const pool = createPool([])

      expect(() => pickRandom(pool)).toThrow('Track pool is exhausted')
    })
  })

  describe('isExhausted', () => {
    it('should return false for a pool with available tracks', () => {
      const pool = createPool(trackIds)

      expect(isExhausted(pool)).toBe(false)
    })

    it('should return true for an empty pool', () => {
      const pool = createPool([])

      expect(isExhausted(pool)).toBe(true)
    })

    it('should return true after all tracks are picked', () => {
      let state = createPool(['t1'])
      state = pickRandom(state).newState

      expect(isExhausted(state)).toBe(true)
    })
  })
})
