import type { CategoryMatch, FieldBag } from './categoryPredicate'
import { matchesCategory } from './categoryPredicate'

export interface CoverageCategory {
  id: string
  displayName: string
  match: CategoryMatch
  points?: number
}

export interface CoverageTrack {
  id: string
  fields: FieldBag
}

export interface CategoryCoverage {
  categoryId: string
  displayName: string
  /** Carried through from the input so a report row renders without joining back to the category. */
  points?: number
  count: number
  /** count < plannedRounds — warns that the category cannot fill the planned number of rounds */
  tooFewForRounds: boolean
}

export interface CoverageReport {
  total: number
  perCategory: CategoryCoverage[]
  matchedByNone: number
  matchedByMultiple: number
}

/**
 * Counts how the materialized pool spreads over a set of categories, so the host sees before the
 * game how many tracks land where.
 *
 * The numbers are **after `valueLimitations`**: the caller (`LocalSetupView`) runs
 * `applyValuesLimitations` on the pool before it ever reaches this function, so a category's count
 * reflects what a game can actually deal, not the raw, untrimmed library (main plan §4.2).
 *
 * `plannedRounds === null` means unlimited rounds, so nothing can be "too few".
 */
export function buildCoverageReport(
  tracks: CoverageTrack[],
  categories: CoverageCategory[],
  plannedRounds: number | null,
): CoverageReport {
  const counts = new Map<string, number>(categories.map(category => [category.id, 0]))
  let matchedByNone = 0
  let matchedByMultiple = 0

  for (const track of tracks) {
    let matches = 0
    for (const category of categories) {
      if (!matchesCategory(track.fields, category.match))
        continue
      matches++
      counts.set(category.id, (counts.get(category.id) ?? 0) + 1)
    }

    if (matches === 0)
      matchedByNone++
    else if (matches > 1)
      matchedByMultiple++
  }

  const perCategory = categories.map<CategoryCoverage>((category) => {
    const count = counts.get(category.id) ?? 0
    return {
      categoryId: category.id,
      displayName: category.displayName,
      points: category.points,
      count,
      tooFewForRounds: plannedRounds !== null && count < plannedRounds,
    }
  })

  return { total: tracks.length, perCategory, matchedByNone, matchedByMultiple }
}
