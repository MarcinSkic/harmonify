import type { FieldMinDistance } from '../minDistance'
import type { FieldBag } from '@/lib/categoryPredicate'
import { describe, expect, it } from 'vitest'
import { selectByMinDistance } from '../minDistance'

interface TestTrack { id: string, fields: FieldBag }

function track(id: string, fields: FieldBag): TestTrack {
  return { id, fields }
}

/** A history of one-value `work` bags, oldest first — one entry per round already played. */
function playedWorks(...works: string[]): FieldBag[] {
  return works.map(work => ({ work: [work] }))
}

describe('selectByMinDistance', () => {
  it('returns undefined for an empty list of candidates', () => {
    const result = selectByMinDistance([], playedWorks('Madoka'), [{ name: 'work', distance: 5 }])

    expect(result).toBeUndefined()
  })

  it('is the identity when the list of rules is empty', () => {
    const candidates = [track('1', { work: ['Madoka'] }), track('2', { work: ['Nanoha'] })]

    const result = selectByMinDistance(candidates, playedWorks('Madoka', 'Madoka'), [])

    expect(result?.track).toBe(candidates[0])
    expect(result?.score).toBe(Number.POSITIVE_INFINITY)
    expect(result?.fallback).toBe(false)
    expect(result?.limiting).toEqual([])
    expect(result?.eligibleCount).toBe(2)
  })

  it('measures the gap from the last occurrence in the history, not the first', () => {
    // "Madoka" ran in round 1 and again in round 3 of four played rounds: the gap is 2, not 4.
    const history = playedWorks('Madoka', 'Nanoha', 'Madoka', 'Fate')
    const candidates = [track('1', { work: ['Madoka'] }), track('2', { work: ['Symphogear'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 3 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.track.id).toBe('2')
    expect(result?.limiting).toEqual([])
  })

  it('lets a work last played in round 3 through in round 8 under distance 5', () => {
    const history = playedWorks('A', 'B', 'Madoka', 'C', 'D', 'E', 'F') // candidate lands in round 8
    const candidates = [track('1', { work: ['Madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 5 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.track.id).toBe('1')
    expect(result?.score).toBe(0)
    expect(result?.fallback).toBe(false)
    expect(result?.eligibleCount).toBe(1)
  })

  it('blocks a work last played in round 3 in round 7 under distance 5', () => {
    const history = playedWorks('A', 'B', 'Madoka', 'C', 'D', 'E') // candidate lands in round 7
    const candidates = [track('1', { work: ['Madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 5 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.score).toBe(-1)
    expect(result?.fallback).toBe(true)
    expect(result?.eligibleCount).toBe(0)
  })

  it('blocks nothing under distance 1 — the boundary below what can be configured', () => {
    // `fieldMinDistanceSchema` requires `distance >= 2` precisely because of this: the engine is
    // pure arithmetic and computes it, but 1 is a rule nobody can store.
    const candidates = [track('1', { work: ['Madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 1 }]

    const result = selectByMinDistance(candidates, playedWorks('Madoka'), rules)

    expect(result?.score).toBe(0)
    expect(result?.fallback).toBe(false)
  })

  it('treats a candidate without a value in the rule field as always eligible', () => {
    const candidates = [
      track('1', { work: ['Madoka'] }), // just played, blocked
      track('2', {}), // a track from the local library carries no fields at all
    ]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 5 }]

    const result = selectByMinDistance(candidates, playedWorks('Madoka'), rules)

    expect(result?.track.id).toBe('2')
    expect(result?.score).toBe(Number.POSITIVE_INFINITY)
    expect(result?.eligibleCount).toBe(1)
  })

  it('skips blank values in both the history and the candidate', () => {
    const history: FieldBag[] = [{ work: ['   ', 'Madoka'] }]
    const candidates = [track('1', { work: ['  '] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 5 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.score).toBe(Number.POSITIVE_INFINITY)
    expect(result?.fallback).toBe(false)
  })

  it('folds case when matching a candidate value against the history', () => {
    const history: FieldBag[] = [{ work: ['MADOKA'] }]
    const candidates = [track('1', { work: ['madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 3 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.score).toBe(-2)
    expect(result?.limiting).toEqual([{ field: 'work', value: 'madoka', gap: 1, required: 3 }])
  })

  it('looks the field up exactly: Work is not work', () => {
    const history: FieldBag[] = [{ Work: ['Madoka'] }]
    const candidates = [track('1', { work: ['Madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 5 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.score).toBe(Number.POSITIVE_INFINITY)
  })

  it('lets the tightest value of a multi-valued tag decide', () => {
    // A crossover track: "Madoka" is four rounds back and fine, "Nanoha" ran last round.
    const history = playedWorks('Madoka', 'A', 'B', 'Nanoha')
    const candidates = [track('1', { work: ['Madoka', 'Nanoha'] }), track('2', { work: ['Fate'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 3 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.track.id).toBe('2')

    const alone = selectByMinDistance([candidates[0]], history, rules)
    expect(alone?.score).toBe(-2)
    expect(alone?.limiting).toEqual([{ field: 'work', value: 'nanoha', gap: 1, required: 3 }])
  })

  it('takes the tightest across several rules, even when another rule has room', () => {
    const history: FieldBag[] = [
      { work: ['Madoka'], grouping: ['op'] },
      { work: ['Nanoha'], grouping: ['ed'] },
      { work: ['Fate'], grouping: ['ed'] },
    ]
    const candidates = [track('1', { work: ['Madoka'], grouping: ['ed'] })]
    const rules: FieldMinDistance[] = [
      { name: 'work', distance: 2 }, // gap 3 → score 1, plenty of room
      { name: 'grouping', distance: 5 }, // gap 1 → score -4, this is what decides
    ]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.score).toBe(-4)
    expect(result?.limiting).toEqual([{ field: 'grouping', value: 'ed', gap: 1, required: 5 }])
  })

  it('takes the first eligible candidate in input order, not the highest-scoring one', () => {
    // "Madoka" scores exactly 0 and "Fate" scores +∞; input order still decides between them,
    // otherwise the pick would drift towards the least recently played work every round.
    const candidates = [track('1', { work: ['Madoka'] }), track('2', { work: ['Fate'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 2 }]

    const result = selectByMinDistance(candidates, playedWorks('Madoka', 'Nanoha'), rules)

    expect(result?.track).toBe(candidates[0])
    expect(result?.score).toBe(0)
    expect(result?.eligibleCount).toBe(2)
  })

  it('counts every eligible candidate, not only the ones scanned before the pick', () => {
    const candidates = [
      track('1', { work: ['Madoka'] }), // blocked, just played
      track('2', { work: ['Fate'] }),
      track('3', { work: ['Symphogear'] }),
    ]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 5 }]

    const result = selectByMinDistance(candidates, playedWorks('Madoka'), rules)

    expect(result?.track.id).toBe('2')
    expect(result?.eligibleCount).toBe(2)
  })

  it('breaks a tie between equally blocked candidates by input order', () => {
    const candidates = [track('1', { work: ['Madoka'] }), track('2', { work: ['Madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 4 }]

    const result = selectByMinDistance(candidates, playedWorks('Madoka', 'Nanoha'), rules)

    expect(result?.track).toBe(candidates[0])
    expect(result?.score).toBe(-2)
    expect(result?.fallback).toBe(true)
  })

  it('falls back to the least offending candidate when every one breaks the rules', () => {
    const candidates = [
      track('1', { work: ['Nanoha'] }), // gap 1 → score -2
      track('2', { work: ['Madoka'] }), // gap 2 → score -1, the smallest violation
    ]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 3 }]

    const result = selectByMinDistance(candidates, playedWorks('Madoka', 'Nanoha'), rules)

    expect(result?.track.id).toBe('2')
    expect(result?.score).toBe(-1)
    expect(result?.fallback).toBe(true)
    expect(result?.eligibleCount).toBe(0)
    expect(result?.limiting).toEqual([{ field: 'work', value: 'madoka', gap: 2, required: 3 }])
  })

  it('ranks the fallback by gap minus distance, not by the bare gap', () => {
    const history: FieldBag[] = [
      {},
      {},
      {},
      {},
      { album: ['OST'] }, // gap 6 against distance 10 → score -4
      {},
      { work: ['Madoka'] }, // gap 4 against distance 5 → score -1
      {},
      {},
      {},
    ]
    const candidates = [
      track('1', { album: ['OST'] }), // the larger gap, but the worse score
      track('2', { work: ['Madoka'] }),
    ]
    const rules: FieldMinDistance[] = [
      { name: 'work', distance: 5 },
      { name: 'album', distance: 10 },
    ]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.track.id).toBe('2')
    expect(result?.score).toBe(-1)
    expect(result?.fallback).toBe(true)
  })

  it('reports the limiting pairs of an eligible track too, describing the room it had left', () => {
    const history = playedWorks('A', 'B', 'Madoka', 'C', 'D', 'E', 'F')
    const candidates = [track('1', { work: ['Madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 5 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.score).toBe(0)
    expect(result?.fallback).toBe(false)
    expect(result?.limiting).toEqual([{ field: 'work', value: 'madoka', gap: 5, required: 5 }])
  })

  it('reports every pair that ties for the score', () => {
    const history: FieldBag[] = [
      { work: ['Madoka'], grouping: ['op'] },
      { work: ['Nanoha'], grouping: ['ed'] },
    ]
    const candidates = [track('1', { work: ['Madoka'], grouping: ['op'] })]
    const rules: FieldMinDistance[] = [
      { name: 'work', distance: 4 }, // gap 2 → score -2
      { name: 'grouping', distance: 4 }, // gap 2 → score -2 as well
    ]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.score).toBe(-2)
    expect(result?.limiting).toEqual([
      { field: 'work', value: 'madoka', gap: 2, required: 4 },
      { field: 'grouping', value: 'op', gap: 2, required: 4 },
    ])
  })

  it('ignores history rounds that carry no value in a rule field', () => {
    const history: FieldBag[] = [{ work: ['Madoka'] }, {}, {}, {}]
    const candidates = [track('1', { work: ['Madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 4 }]

    const result = selectByMinDistance(candidates, history, rules)

    expect(result?.score).toBe(0) // gap 4 against distance 4
    expect(result?.fallback).toBe(false)
  })

  it('treats an empty history as no constraint at all', () => {
    const candidates = [track('1', { work: ['Madoka'] })]
    const rules: FieldMinDistance[] = [{ name: 'work', distance: 5 }]

    const result = selectByMinDistance(candidates, [], rules)

    expect(result?.track).toBe(candidates[0])
    expect(result?.score).toBe(Number.POSITIVE_INFINITY)
    expect(result?.eligibleCount).toBe(1)
  })
})
