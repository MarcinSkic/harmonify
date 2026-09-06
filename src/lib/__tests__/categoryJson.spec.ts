import type { Category, CategorySet, FieldLimitation, FieldMinDistance } from '@/db/schemas'
import { describe, expect, it } from 'vitest'
import {
  parseCategoriesJSON,
  parseCategorySetsJSON,
  serializeCategoriesJSON,
  serializeCategorySetsJSON,
} from '../categoryJson'

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Category',
    match: { all: [{ is: { grouping: 'op' } }] },
    createdAt: 1,
    ...overrides,
  }
}

function makeSet(name: string): CategorySet {
  return { id: `set-${name}`, name, valueLimitations: [], minDistances: [], createdAt: 1 }
}

describe('serializeCategoriesJSON', () => {
  it('sorts by displayName and drops the persistence-only fields', () => {
    const json = serializeCategoriesJSON([
      makeCategory({ displayName: 'B' }),
      makeCategory({ displayName: 'A', description: 'first', points: 10 }),
    ])

    expect(JSON.parse(json)).toEqual([
      { displayName: 'A', description: 'first', points: 10, match: { all: [{ is: { grouping: 'op' } }] } },
      { displayName: 'B', match: { all: [{ is: { grouping: 'op' } }] } },
    ])
  })
})

describe('parseCategoriesJSON round trip', () => {
  const matches: Category['match'][] = [
    { all: [{ is: { grouping: 'op' } }] },
    { all: [{ isNot: { grouping: 'ed' } }] },
    { all: [{ contains: { title: 'love' } }] },
    { all: [{ gt: { popularity: 2 } }] },
    { all: [{ lt: { popularity: 5 } }] },
    { all: [{ inTheRange: { year: [1990, 1999] } }] },
    { all: [{ isMissing: { mood: true } }] },
    { all: [{ isPresent: { mood: true } }] },
    { any: [{ is: { grouping: 'op' } }, { gt: { popularity: 2 } }] },
  ]

  it.each(matches)('survives serialize → parse → serialize for %j', (match) => {
    const original = serializeCategoriesJSON([makeCategory({ match })])
    const { rows, errors } = parseCategoriesJSON(original)

    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].match).toEqual(match)
    expect(serializeCategoriesJSON(rows.map(row => makeCategory(row)))).toBe(original)
  })

  it('keeps the acceptance-criterion predicate intact', () => {
    const { rows, errors } = parseCategoriesJSON(JSON.stringify([{
      displayName: 'Popularne Anime OP',
      points: 10,
      match: { all: [{ is: { grouping: 'op' } }, { gt: { popularity: 2 } }] },
    }]))

    expect(errors).toEqual([])
    expect(rows[0]).toEqual({
      displayName: 'Popularne Anime OP',
      points: 10,
      match: { all: [{ is: { grouping: 'op' } }, { gt: { popularity: 2 } }] },
    })
  })
})

describe('parseCategoriesJSON errors', () => {
  it('reports a broken element by index and imports the rest', () => {
    const { rows, errors } = parseCategoriesJSON(JSON.stringify([
      { displayName: 'Good', match: { all: [{ is: { grouping: 'op' } }] } },
      { displayName: 'No match at all' },
      { displayName: 'Also good', match: { any: [{ contains: { title: 'x' } }] } },
    ]))

    expect(rows.map(r => r.displayName)).toEqual(['Good', 'Also good'])
    expect(errors).toHaveLength(1)
    expect(errors[0].index).toBe(1)
  })

  it('rejects a condition mixing two operators', () => {
    const { rows, errors } = parseCategoriesJSON(JSON.stringify([
      { displayName: 'Mixed', match: { all: [{ is: { grouping: 'op' }, gt: { popularity: 2 } }] } },
    ]))

    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('rejects a condition naming two fields', () => {
    const { rows, errors } = parseCategoriesJSON(JSON.stringify([
      { displayName: 'Two fields', match: { all: [{ is: { grouping: 'op', mood: 'happy' } }] } },
    ]))

    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('rejects a numeric operand written as a string', () => {
    const { rows, errors } = parseCategoriesJSON(JSON.stringify([
      { displayName: 'Stringy', match: { all: [{ gt: { popularity: '2' } }] } },
    ]))

    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('reports a name repeated inside the file at its own index', () => {
    const { rows, errors } = parseCategoriesJSON(JSON.stringify([
      { displayName: 'Twin', match: { all: [{ is: { grouping: 'op' } }] } },
      { displayName: 'Other', match: { all: [{ is: { grouping: 'ed' } }] } },
      { displayName: 'Twin', match: { all: [{ is: { grouping: 'ost' } }] } },
    ]))

    expect(rows.map(r => r.displayName)).toEqual(['Twin', 'Other'])
    expect(errors).toEqual([{ index: 2, message: 'Duplicate category "Twin" in the file' }])
  })

  it('throws on text that is not JSON', () => {
    expect(() => parseCategoriesJSON('displayName,tagFilter\nOST,ost')).toThrow(/JSON parse error/)
  })

  it('throws when the JSON is not an array', () => {
    expect(() => parseCategoriesJSON('{"displayName":"OST"}')).toThrow(/array/)
  })
})

describe('category sets', () => {
  it('writes membership in `order` and reads it back as array position', () => {
    const first = makeCategory({ id: 'a', displayName: 'First' })
    const second = makeCategory({ id: 'b', displayName: 'Second' })
    const third = makeCategory({ id: 'c', displayName: 'Third' })

    const json = serializeCategorySetsJSON([{
      set: makeSet('Konkurs 2026'),
      members: [
        { category: third, order: 2 },
        { category: first, order: 0 },
        { category: second, order: 1 },
      ],
    }])

    expect(JSON.parse(json)).toEqual([
      { name: 'Konkurs 2026', categories: ['First', 'Second', 'Third'], valueLimitations: [], minDistances: [] },
    ])

    const { rows, errors } = parseCategorySetsJSON(json)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { name: 'Konkurs 2026', categories: ['First', 'Second', 'Third'], valueLimitations: [], minDistances: [] },
    ])
  })

  it('uses the same shape for one set and for many', () => {
    const one = JSON.parse(serializeCategorySetsJSON([
      { set: makeSet('Only'), members: [] },
    ])) as unknown[]
    const many = JSON.parse(serializeCategorySetsJSON([
      { set: makeSet('Only'), members: [] },
      { set: makeSet('Second'), members: [] },
    ])) as unknown[]

    expect(one).toHaveLength(1)
    expect(many).toHaveLength(2)
    expect(many[0]).toEqual(one[0])
  })

  it('accepts a set naming a category that does not exist — resolution happens on import', () => {
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      { name: 'Konkurs', categories: ['Ghost category'] },
    ]))

    expect(errors).toEqual([])
    expect(rows[0].categories).toEqual(['Ghost category'])
  })

  it('reports a broken element by index and imports the rest', () => {
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      { name: 'Good', categories: [] },
      { name: '', categories: [] },
      { categories: ['A'] },
      { name: 'Also good', categories: ['A'] },
    ]))

    expect(rows.map(r => r.name)).toEqual(['Good', 'Also good'])
    expect(errors.map(e => e.index)).toEqual([1, 2])
  })

  it('reports a set name repeated inside the file', () => {
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      { name: 'Twin', categories: ['A'] },
      { name: 'Twin', categories: ['B'] },
    ]))

    expect(rows).toHaveLength(1)
    expect(errors).toEqual([{ index: 1, message: 'Duplicate set "Twin" in the file' }])
  })
})

describe('category set value limitations', () => {
  it('reads a Phase 2 file without the field as an empty list', () => {
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      { name: 'Pre-Phase-3', categories: ['A'] },
    ]))

    expect(errors).toEqual([])
    expect(rows[0].valueLimitations).toEqual([])
  })

  it('survives a round trip with exceptions and multiValue intact', () => {
    const limitations: FieldLimitation[] = [
      {
        name: 'work',
        selfLimit: 3,
        multiValue: 'first',
        otherValuesLimit: [
          { name: 'grouping', limit: 1, multiValue: 'all' },
        ],
        exceptions: [
          { value: 'Puella Magi Madoka Magica', selfLimit: 4 },
        ],
      },
    ]

    const original = serializeCategorySetsJSON([{
      set: { ...makeSet('Konkurs 2026'), valueLimitations: limitations },
      members: [],
    }])
    const { rows, errors } = parseCategorySetsJSON(original)

    expect(errors).toEqual([])
    expect(rows[0].valueLimitations).toEqual(limitations)
  })

  it('reports a duplicate limitation name inside one set as a row error', () => {
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      {
        name: 'Konkurs',
        categories: [],
        valueLimitations: [
          { name: 'work', selfLimit: 3 },
          { name: 'work', selfLimit: 1 },
        ],
      },
      { name: 'Also good', categories: [] },
    ]))

    expect(rows.map(r => r.name)).toEqual(['Also good'])
    expect(errors).toEqual([{ index: 0, message: 'Duplicate value limitation "work" in set "Konkurs"' }])
  })

  it('reports a duplicate pair limit name inside one entry as a row error', () => {
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      {
        name: 'Konkurs',
        categories: [],
        valueLimitations: [
          {
            name: 'work',
            selfLimit: 3,
            otherValuesLimit: [
              { name: 'grouping', limit: 1 },
              { name: 'grouping', limit: 2 },
            ],
          },
        ],
      },
      { name: 'Also good', categories: [] },
    ]))

    expect(rows.map(r => r.name)).toEqual(['Also good'])
    expect(errors).toEqual([
      { index: 0, message: 'Duplicate pair limit "grouping" in value limitation "work" of set "Konkurs"' },
    ])
  })

  it('rejects an unknown key inside a limitation as a row error, importing the rest of the sets', () => {
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      {
        name: 'Broken',
        categories: [],
        valueLimitations: [
          { name: 'work', selfLimit: 3, typo: true },
        ],
      },
      { name: 'Good', categories: [] },
    ]))

    expect(rows.map(r => r.name)).toEqual(['Good'])
    expect(errors).toHaveLength(1)
    expect(errors[0].index).toBe(0)
  })

  it('loads the human-written v5 example structure without error — the format contract', () => {
    // Pasted from `.claude/.plans/Harmonify v5 - human written base.md`, key `valuesLimitations`.
    const exampleFromDoc = [
      {
        name: 'work',
        selfLimit: 3,
        otherValuesLimit: [
          {
            name: 'grouping',
            limit: 1,
            exceptions: [
              { value: 'op', limit: 2 },
            ],
          },
        ],
        exceptions: [
          { value: 'Urusei Yatsura', selfLimit: 2 },
          {
            value: 'Puella Magi Madoka Magica',
            selfLimit: 4,
            otherValuesLimit: [
              {
                name: 'grouping',
                limit: 2,
                exceptions: [
                  { value: 'ost', limit: 1 },
                ],
              },
            ],
          },
        ],
      },
    ]

    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      { name: 'From the doc', categories: [], valueLimitations: exampleFromDoc },
    ]))

    expect(errors).toEqual([])
    expect(rows[0].valueLimitations).toEqual(exampleFromDoc)
  })
})

describe('category set minimum distances', () => {
  it('reads a file written before the field existed as an empty list', () => {
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      { name: 'Pre-Phase-4', categories: ['A'] },
    ]))

    expect(errors).toEqual([])
    expect(rows[0].minDistances).toEqual([])
  })

  it('survives a round trip', () => {
    const minDistances: FieldMinDistance[] = [
      { name: 'album', distance: 3 },
      { name: 'work', distance: 5 },
    ]

    const original = serializeCategorySetsJSON([{
      set: { ...makeSet('Konkurs 2026'), minDistances },
      members: [],
    }])
    const { rows, errors } = parseCategorySetsJSON(original)

    expect(errors).toEqual([])
    expect(rows[0].minDistances).toEqual(minDistances)
  })

  it('reports a duplicate field name inside one set as a row error', () => {
    // Two entries for `work` are two answers to one question, not a sum — the same reading a
    // repeated value limitation gets.
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      {
        name: 'Konkurs',
        categories: [],
        minDistances: [
          { name: 'work', distance: 5 },
          { name: 'work', distance: 2 },
        ],
      },
      { name: 'Also good', categories: [] },
    ]))

    expect(rows.map(r => r.name)).toEqual(['Also good'])
    expect(errors).toEqual([{ index: 0, message: 'Duplicate minimum distance "work" in set "Konkurs"' }])
  })

  it('rejects a distance below two as a row error, importing the rest of the sets', () => {
    // `distance: 1` blocks nothing at all, so it is as much of a mistake as 0 — the file must not
    // carry a rule that cannot do anything.
    const { rows, errors } = parseCategorySetsJSON(JSON.stringify([
      { name: 'Zero', categories: [], minDistances: [{ name: 'work', distance: 0 }] },
      { name: 'One', categories: [], minDistances: [{ name: 'work', distance: 1 }] },
      { name: 'Also good', categories: [] },
    ]))

    expect(rows.map(r => r.name)).toEqual(['Also good'])
    expect(errors.map(e => e.index)).toEqual([0, 1])
    // The row error has to name the field and say what is wrong, not just fail.
    expect(errors[1].message).toContain('minDistances.0.distance')
    expect(errors[1].message).toContain('at least 2')
  })
})
