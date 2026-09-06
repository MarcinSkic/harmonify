import type { ConditionRow } from '../categoryMatchRows'
import { describe, expect, it } from 'vitest'
import { conditionSchema } from '@/db/schemas'
import { conditionsFromRows, emptyRow, rowError, rowsFromMatch, toCondition, toRow } from '../categoryMatchRows'

function row(overrides: Partial<ConditionRow>): ConditionRow {
  return { ...emptyRow(), ...overrides }
}

describe('toCondition', () => {
  it('produces a schema-valid condition for every operator', () => {
    const rows: ConditionRow[] = [
      row({ field: 'grouping', operator: 'is', value: 'op' }),
      row({ field: 'grouping', operator: 'isNot', value: 'ed' }),
      row({ field: 'title', operator: 'contains', value: 'love' }),
      row({ field: 'popularity', operator: 'gt', value: '3' }),
      row({ field: 'popularity', operator: 'lt', value: '9' }),
      row({ field: 'popularity', operator: 'inTheRange', value: '1', rangeEnd: '5' }),
      row({ field: 'work', operator: 'isMissing' }),
      row({ field: 'work', operator: 'isPresent' }),
    ]

    for (const conditionRow of rows)
      expect(conditionSchema.safeParse(toCondition(conditionRow)).success).toBe(true)
  })

  it('coerces numeric operands to numbers', () => {
    expect(toCondition(row({ field: 'popularity', operator: 'gt', value: '3' }))).toEqual({ gt: { popularity: 3 } })
    expect(toCondition(row({ field: 'popularity', operator: 'inTheRange', value: '1', rangeEnd: '5' })))
      .toEqual({ inTheRange: { popularity: [1, 5] } })
  })

  it('trims the field name and the text operand an imported file may carry', () => {
    expect(toCondition(row({ field: '  grouping  ', operator: 'is', value: '  op  ' })))
      .toEqual({ is: { grouping: 'op' } })
  })

  it('returns null for an incomplete row', () => {
    expect(toCondition(emptyRow())).toBeNull()
    expect(toCondition(row({ field: 'popularity', operator: 'gt', value: '' }))).toBeNull()
  })
})

describe('toRow', () => {
  it('round-trips every operator back into the row it came from', () => {
    const rows: ConditionRow[] = [
      row({ field: 'grouping', operator: 'is', value: 'op' }),
      row({ field: 'grouping', operator: 'isNot', value: 'ed' }),
      row({ field: 'title', operator: 'contains', value: 'love' }),
      row({ field: 'popularity', operator: 'gt', value: '3' }),
      row({ field: 'popularity', operator: 'lt', value: '9' }),
      row({ field: 'popularity', operator: 'inTheRange', value: '1', rangeEnd: '5' }),
      row({ field: 'work', operator: 'isMissing' }),
      row({ field: 'work', operator: 'isPresent' }),
    ]

    for (const conditionRow of rows)
      expect(toRow(toCondition(conditionRow)!)).toEqual(conditionRow)
  })

  // `isMissing: false` and `isPresent: true` mean the same thing — an imported file may carry the
  // negated operand, which the editor has no row for.
  it('collapses a negated operand onto its positive twin', () => {
    expect(toRow({ isMissing: { work: false } })).toEqual(row({ field: 'work', operator: 'isPresent' }))
    expect(toRow({ isPresent: { work: false } })).toEqual(row({ field: 'work', operator: 'isMissing' }))
  })

  it('falls back to an empty row for a condition naming no field', () => {
    expect(toRow({ is: {} })).toEqual(emptyRow())
  })
})

describe('rowsFromMatch', () => {
  it('maps the conditions of an `all` match', () => {
    expect(rowsFromMatch({ all: [{ is: { grouping: 'op' } }, { gt: { popularity: 3 } }] })).toEqual([
      row({ field: 'grouping', operator: 'is', value: 'op' }),
      row({ field: 'popularity', operator: 'gt', value: '3' }),
    ])
  })

  it('maps the conditions of an `any` match', () => {
    expect(rowsFromMatch({ any: [{ contains: { title: 'love' } }] })).toEqual([
      row({ field: 'title', operator: 'contains', value: 'love' }),
    ])
  })

  it('starts a match-less editor on a single empty row', () => {
    expect(rowsFromMatch(null)).toEqual([emptyRow()])
  })
})

describe('rowError', () => {
  it('asks for a field before anything else', () => {
    expect(rowError(row({ operator: 'is', value: 'op' }))).toBe('Choose a field')
  })

  it('asks for a value on an empty text operand', () => {
    expect(rowError(row({ field: 'grouping', operator: 'is' }))).toBe('Enter a value')
  })

  // `Number('')` is 0, so a blank operand must not pass as "greater than zero".
  it('asks for a number on a blank or non-numeric numeric operand', () => {
    expect(rowError(row({ field: 'popularity', operator: 'gt' }))).toBe('Enter a number')
    expect(rowError(row({ field: 'popularity', operator: 'lt', value: 'many' }))).toBe('Enter a number')
  })

  it('requires both ends of a range and rejects an inverted one', () => {
    expect(rowError(row({ field: 'popularity', operator: 'inTheRange', value: '1' })))
      .toBe('Enter both ends of the range as numbers')
    expect(rowError(row({ field: 'popularity', operator: 'inTheRange', value: '5', rangeEnd: '1' })))
      .toBe('The range start must not exceed its end')
    expect(rowError(row({ field: 'popularity', operator: 'inTheRange', value: '1', rangeEnd: '5' }))).toBeNull()
  })

  it('needs no operand for a presence operator', () => {
    expect(rowError(row({ field: 'work', operator: 'isMissing' }))).toBeNull()
    expect(rowError(row({ field: 'work', operator: 'isPresent' }))).toBeNull()
  })
})

describe('conditionsFromRows', () => {
  it('collects the conditions of complete rows in order', () => {
    expect(conditionsFromRows([
      row({ field: 'grouping', operator: 'is', value: 'op' }),
      row({ field: 'popularity', operator: 'gt', value: '3' }),
    ])).toEqual([{ is: { grouping: 'op' } }, { gt: { popularity: 3 } }])
  })

  it('returns null as soon as one row is incomplete', () => {
    expect(conditionsFromRows([
      row({ field: 'grouping', operator: 'is', value: 'op' }),
      emptyRow(),
    ])).toBeNull()
  })
})
