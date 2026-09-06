// Pure helpers for the condition rows of `CategoryMatchEditor.vue`: the mapping between a stored
// `CategoryMatch` and the flat rows the form edits, in both directions.

import type { CategoryMatch, Condition } from '@/db/schemas'

export type Operator = 'is' | 'isNot' | 'contains' | 'gt' | 'lt' | 'inTheRange' | 'isMissing' | 'isPresent'

/**
 * A row is the editable shape: flat and always representable, even mid-edit. It becomes a
 * `Condition` only once it is complete — building conditions in place would leave the previous
 * operator's key behind, which `conditionSchema`'s `strictObject` rejects.
 */
export interface ConditionRow {
  field: string
  operator: Operator
  value: string
  rangeEnd: string
}

export const OPERATOR_LABELS: Record<Operator, string> = {
  is: 'is',
  isNot: 'is not',
  contains: 'contains',
  gt: 'greater than',
  lt: 'less than',
  inTheRange: 'in range',
  isMissing: 'is missing',
  isPresent: 'is present',
}

export const TEXT_OPERATORS: Operator[] = ['is', 'isNot', 'contains']
export const NUMBER_OPERATORS: Operator[] = ['gt', 'lt', 'inTheRange']
export const PRESENCE_OPERATORS: Operator[] = ['isMissing', 'isPresent']
export const ALL_OPERATORS: Operator[] = [...TEXT_OPERATORS, ...NUMBER_OPERATORS, ...PRESENCE_OPERATORS]

export function emptyRow(): ConditionRow {
  return { field: '', operator: 'is', value: '', rangeEnd: '' }
}

function isNumeric(raw: string): boolean {
  return raw.trim() !== '' && Number.isFinite(Number(raw))
}

/** The message shown under a row; `null` means the row is complete. */
export function rowError(row: ConditionRow): string | null {
  if (row.field.trim() === '')
    return 'Choose a field'

  if (PRESENCE_OPERATORS.includes(row.operator))
    return null

  if (TEXT_OPERATORS.includes(row.operator))
    return row.value.trim() === '' ? 'Enter a value' : null

  if (row.operator === 'inTheRange') {
    if (!isNumeric(row.value) || !isNumeric(row.rangeEnd))
      return 'Enter both ends of the range as numbers'
    return Number(row.value) > Number(row.rangeEnd) ? 'The range start must not exceed its end' : null
  }

  // `Number('')` is 0, so a blank operand would silently turn `gt` into "greater than zero".
  return isNumeric(row.value) ? null : 'Enter a number'
}

export function toCondition(row: ConditionRow): Condition | null {
  if (rowError(row) !== null)
    return null

  const field = row.field.trim()

  switch (row.operator) {
    case 'is':
      return { is: { [field]: row.value.trim() } }
    case 'isNot':
      return { isNot: { [field]: row.value.trim() } }
    case 'contains':
      return { contains: { [field]: row.value.trim() } }
    case 'gt':
      return { gt: { [field]: Number(row.value) } }
    case 'lt':
      return { lt: { [field]: Number(row.value) } }
    case 'inTheRange':
      return { inTheRange: { [field]: [Number(row.value), Number(row.rangeEnd)] } }
    case 'isMissing':
      return { isMissing: { [field]: true } }
    case 'isPresent':
      return { isPresent: { [field]: true } }
  }
}

/**
 * The conditions of every row, or `null` as soon as one of them is incomplete — the dialog refuses
 * to save then.
 */
export function conditionsFromRows(rows: ConditionRow[]): Condition[] | null {
  const conditions: Condition[] = []

  for (const row of rows) {
    const condition = toCondition(row)
    if (condition === null)
      return null
    conditions.push(condition)
  }

  return conditions
}

function read<TOperand>(operands: Record<string, TOperand>): [string, TOperand] | null {
  const entry = Object.entries(operands)[0]
  return entry ? [entry[0], entry[1]] : null
}

/**
 * `isMissing: false` and `isPresent: true` mean the same thing, so the negated operands an
 * imported file may carry collapse onto their positive twin instead of being dropped.
 */
export function toRow(condition: Condition): ConditionRow {
  const row = emptyRow()

  if ('is' in condition) {
    const entry = read(condition.is)
    return entry ? { ...row, field: entry[0], operator: 'is', value: entry[1] } : row
  }
  if ('isNot' in condition) {
    const entry = read(condition.isNot)
    return entry ? { ...row, field: entry[0], operator: 'isNot', value: entry[1] } : row
  }
  if ('contains' in condition) {
    const entry = read(condition.contains)
    return entry ? { ...row, field: entry[0], operator: 'contains', value: entry[1] } : row
  }
  if ('gt' in condition) {
    const entry = read(condition.gt)
    return entry ? { ...row, field: entry[0], operator: 'gt', value: String(entry[1]) } : row
  }
  if ('lt' in condition) {
    const entry = read(condition.lt)
    return entry ? { ...row, field: entry[0], operator: 'lt', value: String(entry[1]) } : row
  }
  if ('inTheRange' in condition) {
    const entry = read(condition.inTheRange)
    return entry
      ? { ...row, field: entry[0], operator: 'inTheRange', value: String(entry[1][0]), rangeEnd: String(entry[1][1]) }
      : row
  }
  if ('isMissing' in condition) {
    const entry = read(condition.isMissing)
    return entry ? { ...row, field: entry[0], operator: entry[1] ? 'isMissing' : 'isPresent' } : row
  }

  const entry = read(condition.isPresent)
  return entry ? { ...row, field: entry[0], operator: entry[1] ? 'isPresent' : 'isMissing' } : row
}

export function rowsFromMatch(match: CategoryMatch | null): ConditionRow[] {
  if (!match)
    return [emptyRow()]
  return ('all' in match ? match.all : match.any).map(toRow)
}
