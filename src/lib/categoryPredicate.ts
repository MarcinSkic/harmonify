import type { CategoryMatch, Condition } from '@/db/schemas'

export type { CategoryMatch, Condition }

/** Field name → its values. Tags are multi-valued (`grouping: ['op', 'ed']`), so values are a list. */
export type FieldBag = Record<string, string[]>

/** A value counts as absent when it is empty or whitespace-only. */
function isBlank(value: string): boolean {
  return value.trim() === ''
}

/** Ordinal (culture-invariant) lower-casing — `ToLowerInvariant`, never a locale-aware fold. */
function foldCase(value: string): string {
  return value.toLowerCase()
}

/** Values that survive numeric coercion; blanks and non-numbers are dropped, not turned into 0. */
function numericValues(values: string[]): number[] {
  return values
    .filter(value => !isBlank(value))
    .map(value => Number(value))
    .filter(value => !Number.isNaN(value))
}

function isFieldMissing(values: string[]): boolean {
  return values.every(isBlank)
}

/**
 * Reads the single field → operand pair of a condition and tests it against the field's values.
 * A condition holds exactly one pair — `conditionSchema` enforces that — so anything beyond the
 * first pair is ignored, and a pair-less condition matches nothing instead of passing silently.
 */
function evaluate<TOperand>(
  bag: FieldBag,
  operands: Record<string, TOperand>,
  test: (values: string[], operand: TOperand) => boolean,
): boolean {
  const entry = Object.entries(operands)[0]
  if (!entry)
    return false

  const [field, operand] = entry
  return test(bag[field] ?? [], operand)
}

function matchesCondition(bag: FieldBag, condition: Condition): boolean {
  if ('is' in condition)
    return evaluate(bag, condition.is, (values, operand) => values.some(value => foldCase(value) === foldCase(operand)))

  if ('isNot' in condition)
    return evaluate(bag, condition.isNot, (values, operand) => !values.some(value => foldCase(value) === foldCase(operand)))

  if ('contains' in condition)
    return evaluate(bag, condition.contains, (values, operand) => values.some(value => foldCase(value).includes(foldCase(operand))))

  if ('gt' in condition)
    return evaluate(bag, condition.gt, (values, operand) => numericValues(values).some(value => value > operand))

  if ('lt' in condition)
    return evaluate(bag, condition.lt, (values, operand) => numericValues(values).some(value => value < operand))

  if ('inTheRange' in condition)
    return evaluate(bag, condition.inTheRange, (values, [min, max]) => numericValues(values).some(value => value >= min && value <= max))

  if ('isMissing' in condition)
    return evaluate(bag, condition.isMissing, (values, operand) => isFieldMissing(values) === operand)

  return evaluate(bag, condition.isPresent, (values, operand) => isFieldMissing(values) !== operand)
}

/**
 * Decides whether a bag of metadata fields satisfies a category's predicate.
 *
 * This function is the executable specification of the category model (main plan §5.1): Harmonify
 * v6 re-implements it, probably in another language, so every rule below is normative.
 *
 * - **Field lookup is exact.** Field names come from Navidrome's `tagName` or from the overlay field
 *   registry (whose primary key is case-sensitive), never from free text — `Grouping` and `grouping`
 *   are different fields.
 * - **Multi-valued fields:** a field carries a list of values. A positive operator (`is`, `gt`, `lt`,
 *   `contains`, `inTheRange`) matches when **any** value matches. A field absent from the bag behaves
 *   exactly like a field with no values.
 * - **`isNot`** is the negation of `is` over the whole list: it matches when **no** value equals the
 *   operand. An absent field therefore matches `isNot`.
 * - **Text comparisons (`is`, `isNot`, `contains`) ignore case**, folded with ordinal lower-casing.
 *   This is a requirement, not a nicety: real libraries hold `grouping: ['ED']` next to `['op']`.
 *   Values are not trimmed — only `isMissing` / `isPresent` and numeric coercion treat blanks specially.
 * - **Coercion follows the operator, never the field's declared type:** `gt` / `lt` / `inTheRange`
 *   run `Number()` over every value and **skip** those that are blank or yield `NaN` (so a blank
 *   value never becomes `0`); `is` / `contains` always compare as text. The evaluator never consults
 *   the overlay field registry — it is a pure function over `Record<string, string[]>`.
 * - **`inTheRange`** is closed on both ends: `min <= value <= max`.
 * - **`isMissing: true`** matches when the field is absent **or** all of its values are blank
 *   (empty or whitespace-only). `isPresent: true` is its negation. The `false` operand inverts each
 *   of them, mirroring Navidrome's `.nsp` symmetry.
 * - **`all: []`** matches everything and **`any: []`** matches nothing (the usual logical convention);
 *   `categoryMatchSchema` requires `.min(1)`, so this only closes the definition.
 * - A condition names **exactly one field**; more than one, or none, is rejected when parsing
 *   `conditionSchema` rather than being quietly let through.
 */
export function matchesCategory(bag: FieldBag, match: CategoryMatch): boolean {
  return 'all' in match
    ? match.all.every(condition => matchesCondition(bag, condition))
    : match.any.some(condition => matchesCondition(bag, condition))
}

function formatCondition(condition: Condition): string {
  const describe = <TOperand>(
    operands: Record<string, TOperand>,
    render: (field: string, operand: TOperand) => string,
  ): string => {
    const entry = Object.entries(operands)[0]
    return entry ? render(entry[0], entry[1]) : ''
  }

  if ('is' in condition)
    return describe(condition.is, (field, operand) => `${field} is ${operand}`)

  if ('isNot' in condition)
    return describe(condition.isNot, (field, operand) => `${field} is not ${operand}`)

  if ('contains' in condition)
    return describe(condition.contains, (field, operand) => `${field} contains ${operand}`)

  if ('gt' in condition)
    return describe(condition.gt, (field, operand) => `${field} > ${operand}`)

  if ('lt' in condition)
    return describe(condition.lt, (field, operand) => `${field} < ${operand}`)

  if ('inTheRange' in condition)
    return describe(condition.inTheRange, (field, [min, max]) => `${field} in ${min}–${max}`)

  if ('isMissing' in condition)
    return describe(condition.isMissing, (field, operand) => `${field} is ${operand ? 'missing' : 'present'}`)

  return describe(condition.isPresent, (field, operand) => `${field} is ${operand ? 'present' : 'missing'}`)
}

/**
 * One human-readable line per condition, in the order they are stored — `grouping is op`,
 * `popularity > 2`. The caller supplies the connective, because whether the lines are joined with
 * "and" or "or" is visible in the match itself (`'all' in match`).
 */
export function formatMatch(match: CategoryMatch): string[] {
  const conditions = 'all' in match ? match.all : match.any
  return conditions.map(formatCondition)
}
