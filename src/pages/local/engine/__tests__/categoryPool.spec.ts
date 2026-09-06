import type { CategoryPoolTrack } from '../categoryPool'
import type { Category, CategoryPoolState } from '@/db/schemas'
import type { FieldBag } from '@/lib/categoryPredicate'
import { describe, expect, it } from 'vitest'
import {
  createCategoryPool,
  getCategoryCounts,
  isCategoryPoolExhausted,
  pickFromCategory,
} from '../categoryPool'

function makeTrack(id: string, genres: string[]): CategoryPoolTrack {
  return { id, fields: genres.length > 0 ? { genre: genres } : {} }
}

function genreIs(genre: string): Category['match'] {
  return { all: [{ is: { genre } }] }
}

function makeCategory(id: string, match: Category['match']): Category {
  return {
    id,
    match,
    displayName: id,
    createdAt: 0,
  }
}

/** The bags a running game hands over, keyed by track id — one `work` value per track. */
function worksById(works: Record<string, string>): Record<string, FieldBag> {
  return Object.fromEntries(Object.entries(works).map(([id, work]) => [id, { work: [work] }]))
}

/**
 * A pool state with a hand-written order and history, so a test can say *which* candidate must win.
 * `createCategoryPool` shuffles, which is exactly what these tests must not depend on.
 */
function stateWithPools(
  categoryPools: Record<string, string[]>,
  playedTrackIds: string[] = [],
): CategoryPoolState {
  const initialCounts = Object.fromEntries(
    Object.entries(categoryPools).map(([id, ids]) => [id, ids.length]),
  )
  return { categoryPools, playedTrackIds, initialCounts }
}

describe('categoryPool', () => {
  const tracks: CategoryPoolTrack[] = [
    makeTrack('t1', ['rock']),
    makeTrack('t2', ['rock', 'pop']),
    makeTrack('t3', ['pop']),
    makeTrack('t4', ['jazz']),
    makeTrack('t5', []), // no fields at all, matched by no positive predicate
  ]

  const rockCategory = makeCategory('cat-rock', genreIs('rock'))
  const popCategory = makeCategory('cat-pop', genreIs('pop'))
  const jazzCategory = makeCategory('cat-jazz', genreIs('jazz'))
  const categories = [rockCategory, popCategory, jazzCategory]

  describe('createCategoryPool', () => {
    it('groups tracks by category using the predicate', () => {
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

    it('supports categories that union several values with any', () => {
      const ostCategory = makeCategory('cat-ost', {
        any: [{ is: { genre: 'rock' } }, { is: { genre: 'jazz' } }],
      })
      const pool = createCategoryPool(tracks, [ostCategory])

      expect(pool.categoryPools[ostCategory.id]).toEqual(
        expect.arrayContaining(['t1', 't2', 't4']),
      )
      expect(pool.categoryPools[ostCategory.id]).toHaveLength(3)
    })

    it('leaves a track matched by no predicate out of every pool', () => {
      const pool = createCategoryPool(tracks, categories)
      const allIds = Object.values(pool.categoryPools).flat()

      expect(allIds).not.toContain('t5')
    })

    it('pools the tracks a predicate matches on an absent field', () => {
      const untaggedCategory = makeCategory('cat-untagged', {
        all: [{ isMissing: { genre: true } }],
      })
      const pool = createCategoryPool(tracks, [untaggedCategory])

      expect(pool.categoryPools[untaggedCategory.id]).toEqual(['t5'])
    })

    it('matches field values regardless of case', () => {
      const pool = createCategoryPool(
        [makeTrack('loud', ['ROCK'])],
        [rockCategory],
      )

      expect(pool.categoryPools[rockCategory.id]).toEqual(['loud'])
    })

    it('creates empty pool for category with no matching tracks', () => {
      const orphanCategory = makeCategory('cat-orphan', genreIs('metal'))
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
      // The pick now runs through `selectByMinDistance`; called without a context it runs with no
      // rules, which is the identity, so the outcome is the one the head-of-the-pool pick gave.
      const { trackId, newState, selection } = pickFromCategory(pool, jazzCategory.id)

      expect(trackId).toBe('t4')
      expect(newState.playedTrackIds).toEqual(['t4'])
      expect(newState.categoryPools[jazzCategory.id]).toHaveLength(0)
      expect(selection.score).toBe(Number.POSITIVE_INFINITY)
      expect(selection.fallback).toBe(false)
      expect(selection.eligibleCount).toBe(1)
    })

    it('picks the first track in pool order when the game carries no rules', () => {
      // Two tracks of the same work and no rules: the pool order alone decides, exactly as before.
      const state = stateWithPools({ [rockCategory.id]: ['t2', 't1'] })

      const { trackId } = pickFromCategory(state, rockCategory.id, {
        fieldsById: worksById({ t1: 'Madoka', t2: 'Madoka' }),
        minDistances: [],
      })

      expect(trackId).toBe('t2')
    })

    it('skips a track whose work was played two rounds ago under distance 3', () => {
      // Played so far: Nanoha, then Madoka. A Madoka candidate would land at gap 1 and a Nanoha one
      // at gap 2 — both short of 3 — so the first candidate carrying an unplayed work wins.
      const state = stateWithPools({ [rockCategory.id]: ['madoka', 'nanoha', 'fate'] }, ['p1', 'p2'])

      const { trackId, selection } = pickFromCategory(state, rockCategory.id, {
        fieldsById: worksById({
          p1: 'Nanoha',
          p2: 'Madoka',
          madoka: 'Madoka',
          nanoha: 'Nanoha',
          fate: 'Fate',
        }),
        minDistances: [{ name: 'work', distance: 3 }],
      })

      expect(trackId).toBe('fate')
      expect(selection.fallback).toBe(false)
      expect(selection.eligibleCount).toBe(1)
    })

    it('reads the history from playedTrackIds in play order, force-played tracks included', () => {
      // `playSpecificTrack` appends the host's pick to `playedTrackIds` without coming through here,
      // so a forced track occupies a round of the history like any other — and where it sits in that
      // history is what decides, which is why the same two rounds swapped give the other answer.
      const fieldsById = worksById({ forced: 'Madoka', older: 'Nanoha', m: 'Madoka', n: 'Nanoha' })
      const minDistances = [{ name: 'work', distance: 2 }]

      const forcedLast = pickFromCategory(
        stateWithPools({ [rockCategory.id]: ['m', 'n'] }, ['older', 'forced']),
        rockCategory.id,
        { fieldsById, minDistances },
      )
      const forcedFirst = pickFromCategory(
        stateWithPools({ [rockCategory.id]: ['m', 'n'] }, ['forced', 'older']),
        rockCategory.id,
        { fieldsById, minDistances },
      )

      expect(forcedLast.trackId).toBe('n')
      expect(forcedFirst.trackId).toBe('m')
    })

    it('never blocks a track the game knows no fields for', () => {
      // A game sourced from the local library carries no `fields` at all: every candidate gets an
      // empty bag, no rule reaches it, and the pick stays what it is today.
      const state = stateWithPools({ [rockCategory.id]: ['t1', 't2'] }, ['p1'])

      const { trackId, selection } = pickFromCategory(state, rockCategory.id, {
        fieldsById: worksById({ p1: 'Madoka' }),
        minDistances: [{ name: 'work', distance: 10 }],
      })

      expect(trackId).toBe('t1')
      expect(selection.score).toBe(Number.POSITIVE_INFINITY)
      expect(selection.fallback).toBe(false)
    })

    it('takes the least offending track and flags a fallback when every candidate is blocked', () => {
      // Madoka ran 3 rounds back and Nanoha 1: `distance: 5` blocks both, and Madoka is the one
      // closer to being allowed — so the winner is not the first candidate in pool order.
      const state = stateWithPools({ [rockCategory.id]: ['nanoha', 'madoka'] }, ['p1', 'p2', 'p3'])

      const { trackId, selection } = pickFromCategory(state, rockCategory.id, {
        fieldsById: worksById({
          p1: 'Madoka',
          p2: 'Fate',
          p3: 'Nanoha',
          madoka: 'Madoka',
          nanoha: 'Nanoha',
        }),
        minDistances: [{ name: 'work', distance: 5 }],
      })

      expect(trackId).toBe('madoka')
      expect(selection.fallback).toBe(true)
      expect(selection.eligibleCount).toBe(0)
      expect(selection.score).toBe(-2)
      expect(selection.limiting).toEqual([{ field: 'work', value: 'madoka', gap: 3, required: 5 }])
    })

    it('removes the picked track from ALL categories it belonged to', () => {
      const pool = createCategoryPool(tracks, categories)
      // t2 carries genre [rock, pop], so it sits in both rockCategory and popCategory.
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
      const soloCategory = makeCategory('cat-solo', genreIs('solo'))
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
      const soloCategory = makeCategory('cat-solo', genreIs('solo'))
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
      const soloCategory = makeCategory('cat-solo', genreIs('solo'))
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
      const soloCategory = makeCategory('cat-solo', genreIs('solo'))
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
      const catA = makeCategory('cat-a', genreIs('x'))
      const catB = makeCategory('cat-b', genreIs('x'))
      const pool = createCategoryPool([makeTrack('a', ['x'])], [catA, catB])
      const drained = pickFromCategory(pool, catA.id).newState

      expect(isCategoryPoolExhausted(drained)).toBe(true)
      expect(drained.categoryPools[catB.id]).toEqual([])
    })
  })

  describe('minimum distance across a whole play-through', () => {
    it('keeps five rounds between tracks of one work until the pool cannot honour it', () => {
      // Five "Madoka" tracks against five one-track works. Over ten rounds `distance: 5` lets Madoka
      // through at most twice (1 + floor(9 / 5)), so at least three of its tracks have to break the
      // rule — whatever order `createCategoryPool` shuffled the pool into. Every assertion below
      // holds for every shuffle; nothing here is seeded.
      const works: Record<string, string> = {
        m1: 'Madoka',
        m2: 'Madoka',
        m3: 'Madoka',
        m4: 'Madoka',
        m5: 'Madoka',
        n1: 'Nanoha',
        f1: 'Fate',
        s1: 'Symphogear',
        k1: 'Kanon',
        c1: 'Clannad',
      }
      const poolTracks: CategoryPoolTrack[] = Object.entries(works)
        .map(([id, work]) => ({ id, fields: { work: [work], set: ['all'] } }))
      const everything = makeCategory('cat-all', { all: [{ is: { set: 'all' } }] })
      const distance = 5
      const context = {
        fieldsById: Object.fromEntries(poolTracks.map(track => [track.id, track.fields])),
        minDistances: [{ name: 'work', distance }],
      }

      // The pool of each round is kept as it stood *before* the pick, so eligibility can be
      // recomputed from the outside afterwards instead of being read back off the engine.
      let state = createCategoryPool(poolTracks, [everything])
      const rounds: Array<{ work: string, fallback: boolean, poolBefore: string[] }> = []
      while (!isCategoryPoolExhausted(state)) {
        const poolBefore = [...state.categoryPools[everything.id]]
        const { trackId, newState, selection } = pickFromCategory(state, everything.id, context)
        rounds.push({ work: works[trackId], fallback: selection.fallback, poolBefore })
        state = newState
      }

      /** Rounds between the last play of `work` and the next slot; `undefined` when never played. */
      function roundsSince(work: string, playedSoFar: string[]): number | undefined {
        const lastIndex = playedSoFar.lastIndexOf(work)
        return lastIndex === -1 ? undefined : playedSoFar.length - lastIndex
      }

      expect(rounds).toHaveLength(10)
      rounds.forEach((round, index) => {
        const playedSoFar = rounds.slice(0, index).map(r => r.work)

        // Recomputed from that round's own pool and history — the rule restated by hand, so the
        // check does not depend on anything `selectByMinDistance` reported about itself.
        const hadPlayableTrack = round.poolBefore.some((id) => {
          const gap = roundsSince(works[id], playedSoFar)
          return gap === undefined || gap >= distance
        })

        // The whole point of the fallback: it may happen exactly when nothing playable was left.
        expect(round.fallback).toBe(!hadPlayableTrack)

        if (!round.fallback)
          expect(playedSoFar.slice(-4)).not.toContain(round.work)
      })
      // Three is the floor, not the count: picking the first eligible candidate is not a
      // scheduler, so a shuffle that offers Madoka early can burn a slot and force a fourth
      // fallback. What it may never do is fall back while a legal candidate was available, and
      // that is what the per-round check above asserts.
      expect(rounds.filter(round => round.fallback).length).toBeGreaterThanOrEqual(3)
    })
  })
})
