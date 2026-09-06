import type { Category, CategorySet } from '@/db/schemas'
import { z } from 'zod'
import { categoryMatchSchema } from '@/db/schemas'

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
    })),
    null,
    2,
  )
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
    seen.add(value.name)
    unique.push(value)
  }

  return { rows: unique, errors: [...errors].sort((a, b) => a.index - b.index) }
}
