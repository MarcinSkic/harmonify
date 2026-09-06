import type { FieldLimitation, LimitedTrack } from '../valuesLimitations'
import { describe, expect, it } from 'vitest'
import { applyValuesLimitations } from '../valuesLimitations'

function track(id: string, fields: LimitedTrack['fields']): LimitedTrack {
  return { id, fields }
}

describe('applyValuesLimitations', () => {
  it('is the identity when the list of limitations is empty', () => {
    const tracks = [track('1', { work: ['Madoka'] }), track('2', { work: ['Nanoha'] })]

    const { admitted, totalIn } = applyValuesLimitations(tracks, [])

    expect(admitted).toEqual(tracks)
    expect(admitted[0]).toBe(tracks[0])
    expect(admitted[1]).toBe(tracks[1])
    expect(totalIn).toBe(2)
  })

  it('is the identity for entries with neither selfLimit nor otherValuesLimit', () => {
    const tracks = [track('1', { work: ['Madoka'] }), track('2', { work: ['Madoka'] })]
    const limitations: FieldLimitation[] = [{ name: 'work' }]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted).toEqual(tracks)
    expect(admitted[0]).toBe(tracks[0])
    expect(admitted[1]).toBe(tracks[1])
  })

  it('drops the fourth track sharing the same work under a selfLimit of 3', () => {
    const tracks = [
      track('1', { work: ['Madoka'] }),
      track('2', { work: ['Madoka'] }),
      track('3', { work: ['Madoka'] }),
      track('4', { work: ['Madoka'] }),
    ]
    const limitations: FieldLimitation[] = [{ name: 'work', selfLimit: 3 }]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['1', '2', '3'])
  })

  it('lets a track without the field through regardless of counter state', () => {
    const tracks = [
      track('1', { work: ['Madoka'] }),
      track('2', { work: ['Madoka'] }),
      track('3', { work: ['Madoka'] }),
      track('4', {}),
    ]
    const limitations: FieldLimitation[] = [{ name: 'work', selfLimit: 3 }]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['1', '2', '3', '4'])
  })

  it('charges only selfLimit for a track missing the pair field', () => {
    const tracks = [track('1', { work: ['Madoka'] })]
    const limitations: FieldLimitation[] = [
      { name: 'work', selfLimit: 3, otherValuesLimit: [{ name: 'grouping', limit: 1 }] },
    ]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['1'])
  })

  it('drops a second op from the same work under a work x grouping pair limit of 1, but admits an ed', () => {
    const tracks = [
      track('1', { work: ['Madoka'], grouping: ['op'] }),
      track('2', { work: ['Madoka'], grouping: ['op'] }),
      track('3', { work: ['Madoka'], grouping: ['ed'] }),
    ]
    const limitations: FieldLimitation[] = [
      { name: 'work', otherValuesLimit: [{ name: 'grouping', limit: 1 }] },
    ]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['1', '3'])
  })

  it('multiValue "all" charges every value and drops when either bucket is full (crossover)', () => {
    const tracks = [
      track('1', { work: ['Madoka'] }),
      track('2', { work: ['Nanoha'] }),
      // Crossover track shared by both works — should fill the "Nanoha" bucket too.
      track('3', { work: ['Madoka', 'Nanoha'] }),
      track('4', { work: ['Nanoha'] }),
    ]
    const limitations: FieldLimitation[] = [{ name: 'work', selfLimit: 2, multiValue: 'all' }]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    // After track 3, Nanoha's bucket already holds 2 (tracks 2 and 3), so track 4 is rejected.
    expect(admitted.map(t => t.id)).toEqual(['1', '2', '3'])
  })

  it('multiValue "first" charges only the first non-blank value', () => {
    const tracks = [
      track('1', { work: ['  ', 'Madoka', 'Nanoha'] }),
      track('2', { work: ['Nanoha'] }),
      track('3', { work: ['Nanoha'] }),
    ]
    const limitations: FieldLimitation[] = [{ name: 'work', selfLimit: 2, multiValue: 'first' }]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    // Track 1 only charges "Madoka" (first non-blank), so "Nanoha" still has room for tracks 2 and 3.
    expect(admitted.map(t => t.id)).toEqual(['1', '2', '3'])
  })

  it('is atomic: a track failing the pair check does not charge selfLimit', () => {
    const tracks = [
      track('1', { work: ['Madoka'], grouping: ['op'] }),
      track('2', { work: ['Madoka'], grouping: ['op'] }), // fails the pair limit
      track('3', { work: ['Madoka'], grouping: ['ed'] }), // still has room under selfLimit
    ]
    const limitations: FieldLimitation[] = [
      { name: 'work', selfLimit: 2, otherValuesLimit: [{ name: 'grouping', limit: 1 }] },
    ]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['1', '3'])
  })

  it('folds case for both the field value and the pair value into one bucket', () => {
    const tracks = [
      track('1', { work: ['Madoka'], grouping: ['OP'] }),
      track('2', { work: ['madoka'], grouping: ['op'] }),
      // Repeats the same folded value twice within one track's own list — counts once.
      track('3', { work: ['MADOKA', 'madoka'], grouping: ['Op'] }),
    ]
    const limitations: FieldLimitation[] = [
      { name: 'work', otherValuesLimit: [{ name: 'grouping', limit: 2 }] },
    ]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['1', '2'])
  })

  it('treats an empty or whitespace-only value as absent', () => {
    const tracks = [track('1', { work: ['', '   '] })]
    const limitations: FieldLimitation[] = [{ name: 'work', selfLimit: 0 }]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['1'])
  })

  it('requires both entries of a two-entry list to pass', () => {
    const tracks = [
      track('1', { work: ['Madoka'], album: ['OST'] }),
      track('2', { work: ['Nanoha'], album: ['OST'] }), // fails album, even though work has room
      track('3', { work: ['Madoka'], album: ['Single'] }), // fails work, even though album has room
    ]
    const limitations: FieldLimitation[] = [
      { name: 'work', selfLimit: 1 },
      { name: 'album', selfLimit: 1 },
    ]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['1'])
  })

  it('selfLimit of 0 drops everything with a value and admits everything without one', () => {
    const tracks = [
      track('1', { work: ['Madoka'] }),
      track('2', {}),
    ]
    const limitations: FieldLimitation[] = [{ name: 'work', selfLimit: 0 }]

    const { admitted } = applyValuesLimitations(tracks, limitations)

    expect(admitted.map(t => t.id)).toEqual(['2'])
  })

  it('ignores exceptions entirely — the outcome is identical with or without them', () => {
    const tracks = [
      track('1', { work: ['Madoka'] }),
      track('2', { work: ['Madoka'] }),
      track('3', { work: ['Madoka'] }),
    ]
    const withoutExceptions: FieldLimitation[] = [{ name: 'work', selfLimit: 1 }]
    // If honored, this exception would raise "Madoka"'s limit to 5 and admit every track.
    const withExceptions: FieldLimitation[] = [
      {
        name: 'work',
        selfLimit: 1,
        exceptions: [{ value: 'Madoka', selfLimit: 5 }],
      },
    ]

    const result = applyValuesLimitations(tracks, withoutExceptions)
    const resultWithExceptions = applyValuesLimitations(tracks, withExceptions)

    expect(resultWithExceptions.admitted.map(t => t.id)).toEqual(result.admitted.map(t => t.id))
    expect(resultWithExceptions.admitted.map(t => t.id)).toEqual(['1'])
  })

  it('does not shuffle: the same tracks in two orders yield different but each individually valid cuts', () => {
    // A and B are indistinguishable but for id, both racing for the one "op" slot the pair
    // limit allows — whichever comes first in the input wins it, so the two orderings must admit
    // different id sets, not just a relabeled reversal of the same one.
    const a = track('A', { work: ['Madoka'], grouping: ['op'] })
    const b = track('B', { work: ['Madoka'], grouping: ['op'] })
    const c = track('C', { work: ['Madoka'], grouping: ['ed'] })
    const limitations: FieldLimitation[] = [
      { name: 'work', selfLimit: 2, otherValuesLimit: [{ name: 'grouping', limit: 1 }] },
    ]

    function isValidCut(ids: string[]): boolean {
      const byWork = ids.length // all three share one work
      const opCount = ids.filter(id => id !== 'C').length // A and B both carry grouping "op"
      return byWork <= 2 && opCount <= 1
    }

    const forward = applyValuesLimitations([a, b, c], limitations)
    const reversed = applyValuesLimitations([b, a, c], limitations)

    expect(forward.admitted.map(t => t.id)).toEqual(['A', 'C'])
    expect(reversed.admitted.map(t => t.id)).toEqual(['B', 'C'])
    expect(forward.admitted.map(t => t.id)).not.toEqual(reversed.admitted.map(t => t.id))
    expect(isValidCut(forward.admitted.map(t => t.id))).toBe(true)
    expect(isValidCut(reversed.admitted.map(t => t.id))).toBe(true)
  })

  it('reports totalIn as the input length, even when nothing was dropped', () => {
    const tracks = [track('1', { work: ['Madoka'] }), track('2', { work: ['Nanoha'] })]
    const limitations: FieldLimitation[] = [{ name: 'work', selfLimit: 3 }]

    const { admitted, totalIn } = applyValuesLimitations(tracks, limitations)

    expect(totalIn).toBe(2)
    expect(admitted.length).toBe(2)
  })
})
