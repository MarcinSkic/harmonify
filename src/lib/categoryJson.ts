import type { Category, CategorySet, FieldLimitation, FieldMinDistance } from '@/db/schemas'
import { z } from 'zod'
import { categoryMatchSchema, fieldLimitationSchema, fieldMinDistanceSchema } from '@/db/schemas'

/**
 * Categories and category sets are exchanged as JSON, not CSV: a predicate is a nested structure
 * and a set is an ordered list, neither of which a flat table expresses without inventing a
 * grammar. The track overlay stays in CSV — that one really is a flat table.
 *
 * Both formats are arrays, and a single broken element is reported with its index instead of
 * failing the whole import; only text that is not JSON at all throws.
 */

export interface JsonRowError {
  index: number
  message: string
}

const categoryJsonSchema = z.object({
  displayName: z.string().min(1),
  description: z.string().optional(),
  points: z.number().optional(),
  match: categoryMatchSchema,
})
export type ParsedCategory = z.infer<typeof categoryJsonSchema>

const categorySetJsonSchema = z.object({
  name: z.string().min(1),
  categories: z.array(z.string().min(1)),
  valueLimitations: z.array(fieldLimitationSchema).default([]),
  minDistances: z.array(fieldMinDistanceSchema).default([]),
})
export type ParsedCategorySet = z.infer<typeof categorySetJsonSchema>

/** Rows keep the index they had in the file, so a later uniqueness error can still point at it. */
function parseArray<TSchema extends z.ZodType>(
  text: string,
  schema: TSchema,
  entity: string,
): { rows: Array<{ index: number, value: z.infer<TSchema> }>, errors: JsonRowError[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  }
  catch (error) {
    throw new Error(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!Array.isArray(data))
    throw new Error(`Expected a JSON array of ${entity}`)

  const rows: Array<{ index: number, value: z.infer<TSchema> }> = []
  const errors: JsonRowError[] = []

  data.forEach((raw, index) => {
    const result = schema.safeParse(raw)
    if (!result.success) {
      const issue = result.error.issues[0]
      const path = issue?.path.join('.')
      errors.push({
        index,
        message: path ? `${path}: ${issue.message}` : issue?.message ?? `Invalid ${entity}`,
      })
      return
    }
    rows.push({ index, value: result.data })
  })

  return { rows, errors }
}

export function serializeCategoriesJSON(categories: Category[]): string {
  const sorted = [...categories].sort((a, b) => a.displayName.localeCompare(b.displayName))
  return JSON.stringify(
    sorted.map(category => ({
      displayName: category.displayName,
      ...(category.description !== undefined ? { description: category.description } : {}),
      ...(category.points !== undefined ? { points: category.points } : {}),
      match: category.match,
    })),
    null,
    2,
  )
}

/**
 * `displayName` is unique in the database (`&displayName`), so a name repeated inside the file is
 * a row error here — the collision with an already stored category is caught at import time, where
 * the database is visible.
 */
export function parseCategoriesJSON(text: string): { rows: ParsedCategory[], errors: JsonRowError[] } {
  const { rows, errors } = parseArray(text, categoryJsonSchema, 'categories')

  const seen = new Set<string>()
  const unique: ParsedCategory[] = []

  for (const { index, value } of rows) {
    if (seen.has(value.displayName)) {
      errors.push({ index, message: `Duplicate category "${value.displayName}" in the file` })
      continue
    }
    seen.add(value.displayName)
    unique.push(value)
  }

  return { rows: unique, errors: [...errors].sort((a, b) => a.index - b.index) }
}

/**
 * One shape for both "export this set" and "export every set" — a one-element array versus a
 * many-element one. Membership order is the array order, which is why the stored `order` column
 * does not appear in the file.
 */
export function serializeCategorySetsJSON(
  sets: Array<{ set: CategorySet, members: Array<{ category: Category, order: number }> }>,
): string {
  return JSON.stringify(
    sets.map(({ set, members }) => ({
      name: set.name,
      categories: [...members]
        .sort((a, b) => a.order - b.order)
        .map(member => member.category.displayName),
      // `exceptions` is carried through untouched — the engine ignores it, the format does not.
      // Rows written before this field existed have no `valueLimitations` at all: schemas are never
      // used as parsers on read from Dexie, so `?? []` is the fallback, not `.default([])`.
      valueLimitations: set.valueLimitations ?? [],
      // Written out explicitly for the same reason: this object is built field by field, so a new
      // column of the set only reaches the file once it is named here.
      minDistances: set.minDistances ?? [],
    })),
    null,
    2,
  )
}

/** A limitation's `name` is its identity within one set — a repeat is a row error, not a merge. */
export function findDuplicateLimitationName(limitations: FieldLimitation[]): string | undefined {
  const seen = new Set<string>()
  for (const limitation of limitations) {
    if (seen.has(limitation.name))
      return limitation.name
    seen.add(limitation.name)
  }
  return undefined
}

/**
 * A pair limit's `name` is the Y field it counts against. A repeat within one entry's
 * `otherValuesLimit` would resolve to the same (X, Y) counter through two separate limits — the
 * engine (`valuesLimitations.ts`) charges it once per limit, i.e. more than once per admitted
 * track, silently doubling the cut. Rejected here, not merged or summed.
 */
export function findDuplicatePairLimitationName(otherValuesLimit: Array<{ name: string }>): string | undefined {
  const seen = new Set<string>()
  for (const pair of otherValuesLimit) {
    if (seen.has(pair.name))
      return pair.name
    seen.add(pair.name)
  }
  return undefined
}

/** First entry (if any) whose own `otherValuesLimit` repeats a pair `name`, with the repeated name. */
export function findLimitationWithDuplicatePair(
  limitations: FieldLimitation[],
): { limitation: FieldLimitation, duplicate: string } | undefined {
  for (const limitation of limitations) {
    const duplicate = findDuplicatePairLimitationName(limitation.otherValuesLimit ?? [])
    if (duplicate)
      return { limitation, duplicate }
  }
  return undefined
}

/**
 * A minimum distance's `name` is its identity within one set. Two entries for `work` are two
 * different answers to the same question, not a sum — the same class of silent error Phase 3
 * rejected for `otherValuesLimit`, so it is a row error here too rather than a merge.
 */
export function findDuplicateMinDistanceName(distances: FieldMinDistance[]): string | undefined {
  const seen = new Set<string>()
  for (const distance of distances) {
    if (seen.has(distance.name))
      return distance.name
    seen.add(distance.name)
  }
  return undefined
}

export function parseCategorySetsJSON(text: string): { rows: ParsedCategorySet[], errors: JsonRowError[] } {
  const { rows, errors } = parseArray(text, categorySetJsonSchema, 'category sets')

  const seen = new Set<string>()
  const unique: ParsedCategorySet[] = []

  for (const { index, value } of rows) {
    if (seen.has(value.name)) {
      errors.push({ index, message: `Duplicate set "${value.name}" in the file` })
      continue
    }
    const duplicateLimitation = findDuplicateLimitationName(value.valueLimitations)
    if (duplicateLimitation) {
      errors.push({ index, message: `Duplicate value limitation "${duplicateLimitation}" in set "${value.name}"` })
      continue
    }
    const duplicatePair = findLimitationWithDuplicatePair(value.valueLimitations)
    if (duplicatePair) {
      errors.push({
        index,
        message: `Duplicate pair limit "${duplicatePair.duplicate}" in value limitation "${duplicatePair.limitation.name}" of set "${value.name}"`,
      })
      continue
    }
    const duplicateDistance = findDuplicateMinDistanceName(value.minDistances)
    if (duplicateDistance) {
      errors.push({ index, message: `Duplicate minimum distance "${duplicateDistance}" in set "${value.name}"` })
      continue
    }
    seen.add(value.name)
    unique.push(value)
  }

  return { rows: unique, errors: [...errors].sort((a, b) => a.index - b.index) }
}
