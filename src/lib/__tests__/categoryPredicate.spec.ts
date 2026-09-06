import type { FieldBag } from '../categoryPredicate'
import { describe, expect, it } from 'vitest'
import { conditionSchema } from '@/db/schemas'
import { matchesCategory } from '../categoryPredicate'

const bag: FieldBag = {
  grouping: ['op'],
  genre: ['Anime', 'J-Pop'],
  popularity: ['3'],
  work: [''],
}

describe('is', () => {
  it('matches when a value equals the operand', () => {
    expect(matchesCategory(bag, { all: [{ is: { grouping: 'op' } }] })).toBe(true)
  })

  it('does not match when no value equals the operand', () => {
    expect(matchesCategory(bag, { all: [{ is: { grouping: 'ed' } }] })).toBe(false)
  })

  it('matches when the second value of a multi-valued field matches', () => {
    expect(matchesCategory(bag, { all: [{ is: { genre: 'J-Pop' } }] })).toBe(true)
  })

  it('ignores case on both sides', () => {
    expect(matchesCategory({ grouping: ['ED'] }, { all: [{ is: { grouping: 'ed' } }] })).toBe(true)
    expect(matchesCategory({ grouping: ['op'] }, { all: [{ is: { grouping: 'OP' } }] })).toBe(true)
  })

  it('does not match an absent field', () => {
    expect(matchesCategory(bag, { all: [{ is: { mood: 'calm' } }] })).toBe(false)
  })
})

describe('isNot', () => {
  it('matches when no value equals the operand', () => {
    expect(matchesCategory(bag, { all: [{ isNot: { grouping: 'ed' } }] })).toBe(true)
  })

  it('does not match when any value equals the operand', () => {
    expect(matchesCategory(bag, { all: [{ isNot: { genre: 'anime' } }] })).toBe(false)
  })

  it('matches an absent field', () => {
    expect(matchesCategory(bag, { all: [{ isNot: { mood: 'calm' } }] })).toBe(true)
  })
})

describe('contains', () => {
  it('matches a substring, ignoring case', () => {
    expect(matchesCategory(bag, { all: [{ contains: { genre: 'pop' } }] })).toBe(true)
  })

  it('does not match when no value contains the operand', () => {
    expect(matchesCategory(bag, { all: [{ contains: { genre: 'rock' } }] })).toBe(false)
  })
})

describe('gt / lt', () => {
  it('compares a string-valued field against a numeric operand', () => {
    expect(matchesCategory(bag, { all: [{ gt: { popularity: 2 } }] })).toBe(true)
    expect(matchesCategory(bag, { all: [{ gt: { popularity: 3 } }] })).toBe(false)
    expect(matchesCategory(bag, { all: [{ lt: { popularity: 4 } }] })).toBe(true)
    expect(matchesCategory(bag, { all: [{ lt: { popularity: 3 } }] })).toBe(false)
  })

  it('skips a non-empty but non-numeric value instead of treating it as 0', () => {
    const nonNumeric: FieldBag = { popularity: ['very high'] }
    expect(matchesCategory(nonNumeric, { all: [{ gt: { popularity: 2 } }] })).toBe(false)
    expect(matchesCategory(nonNumeric, { all: [{ lt: { popularity: 2 } }] })).toBe(false)
  })

  it('skips blank values instead of coercing them to 0', () => {
    expect(matchesCategory({ popularity: ['', '   '] }, { all: [{ lt: { popularity: 1 } }] })).toBe(false)
  })

  it('matches when any value of a multi-valued field passes', () => {
    expect(matchesCategory({ popularity: ['abc', '5'] }, { all: [{ gt: { popularity: 4 } }] })).toBe(true)
  })

  it('does not match an absent field', () => {
    expect(matchesCategory(bag, { all: [{ gt: { rating: 0 } }] })).toBe(false)
  })
})

describe('inTheRange', () => {
  it('is closed on both ends', () => {
    expect(matchesCategory({ popularity: ['2'] }, { all: [{ inTheRange: { popularity: [2, 5] } }] })).toBe(true)
    expect(matchesCategory({ popularity: ['5'] }, { all: [{ inTheRange: { popularity: [2, 5] } }] })).toBe(true)
    expect(matchesCategory({ popularity: ['1'] }, { all: [{ inTheRange: { popularity: [2, 5] } }] })).toBe(false)
    expect(matchesCategory({ popularity: ['6'] }, { all: [{ inTheRange: { popularity: [2, 5] } }] })).toBe(false)
  })

  it('skips values that are not numbers', () => {
    expect(matchesCategory({ popularity: ['n/a'] }, { all: [{ inTheRange: { popularity: [0, 10] } }] })).toBe(false)
  })
})

describe('isMissing / isPresent', () => {
  it('treats an absent field as missing', () => {
    expect(matchesCategory(bag, { all: [{ isMissing: { mood: true } }] })).toBe(true)
    expect(matchesCategory(bag, { all: [{ isMissing: { mood: false } }] })).toBe(false)
    expect(matchesCategory(bag, { all: [{ isPresent: { mood: true } }] })).toBe(false)
    expect(matchesCategory(bag, { all: [{ isPresent: { mood: false } }] })).toBe(true)
  })

  it('treats a field with only blank values as missing', () => {
    expect(matchesCategory(bag, { all: [{ isMissing: { work: true } }] })).toBe(true)
    expect(matchesCategory({ work: ['   '] }, { all: [{ isPresent: { work: true } }] })).toBe(false)
  })

  it('treats a field with any non-blank value as present', () => {
    expect(matchesCategory(bag, { all: [{ isPresent: { grouping: true } }] })).toBe(true)
    expect(matchesCategory({ work: ['', 'Madoka'] }, { all: [{ isMissing: { work: true } }] })).toBe(false)
  })
})

describe('all / any', () => {
  it('requires every condition under all', () => {
    // The phase's acceptance criterion: "Popularne Anime OP" = grouping is op AND popularity > 2
    expect(matchesCategory(bag, {
      all: [{ is: { grouping: 'op' } }, { gt: { popularity: 2 } }],
    })).toBe(true)

    expect(matchesCategory({ ...bag, popularity: ['1'] }, {
      all: [{ is: { grouping: 'op' } }, { gt: { popularity: 2 } }],
    })).toBe(false)
  })

  it('requires a single condition under any', () => {
    expect(matchesCategory(bag, {
      any: [{ is: { grouping: 'ed' } }, { gt: { popularity: 2 } }],
    })).toBe(true)

    expect(matchesCategory(bag, {
      any: [{ is: { grouping: 'ed' } }, { gt: { popularity: 9 } }],
    })).toBe(false)
  })

  it('matches everything with an empty all and nothing with an empty any', () => {
    expect(matchesCategory({}, { all: [] })).toBe(true)
    expect(matchesCategory(bag, { any: [] })).toBe(false)
  })

  it('looks fields up case-sensitively', () => {
    expect(matchesCategory(bag, { all: [{ is: { Grouping: 'op' } }] })).toBe(false)
  })
})

describe('conditionSchema', () => {
  it('rejects a condition naming no field', () => {
    expect(conditionSchema.safeParse({ is: {} }).success).toBe(false)
  })

  it('rejects a condition naming more than one field', () => {
    expect(conditionSchema.safeParse({ is: { grouping: 'op', genre: 'Anime' } }).success).toBe(false)
  })

  it('rejects a condition mixing two operators instead of silently dropping one', () => {
    expect(conditionSchema.safeParse({ is: { grouping: 'op' }, gt: { popularity: 2 } }).success).toBe(false)
  })

  it('rejects an operand of the wrong kind for its operator', () => {
    expect(conditionSchema.safeParse({ gt: { popularity: '2' } }).success).toBe(false)
    expect(conditionSchema.safeParse({ inTheRange: { popularity: [1] } }).success).toBe(false)
  })

  it('accepts every operator', () => {
    const conditions = [
      { is: { grouping: 'op' } },
      { isNot: { grouping: 'ed' } },
      { gt: { popularity: 2 } },
      { lt: { popularity: 5 } },
      { contains: { genre: 'pop' } },
      { inTheRange: { popularity: [1, 5] } },
      { isMissing: { work: true } },
      { isPresent: { work: false } },
    ]
    for (const condition of conditions)
      expect(conditionSchema.safeParse(condition).success).toBe(true)
  })
})
