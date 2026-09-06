import type { Category, CategoryPoolState } from '@/db/schemas'
import type { FieldBag } from '@/lib/categoryPredicate'
import { matchesCategory } from '@/lib/categoryPredicate'
import { shuffle } from '@/lib/shuffle'

/** Since Phase 2 a pool is built from predicate categories and nothing else. */
export type EngineCategory = Category

/**
 * All the pool needs off a track: an id to play and the metadata bag its predicate is tested
 * against. `PlaylistBasedCategory` no longer builds pools — it read `playlistIds`, which this shape
 * does not carry — and survives only so games frozen in Phase 1 still show their category names.
 */
export interface CategoryPoolTrack {
  id: string
  fields: FieldBag
}

export function createCategoryPool(
  tracks: CategoryPoolTrack[],
  categories: EngineCategory[],
): CategoryPoolState {
  const categoryPools: Record<string, string[]> = {}
  for (const category of categories) {
    const matchingIds = tracks
      .filter(track => matchesCategory(track.fields, category.match))
      .map(track => track.id)
    categoryPools[category.id] = shuffle(matchingIds)
  }

  const initialCounts: Record<string, number> = {}
  for (const [id, ids] of Object.entries(categoryPools))
    initialCounts[id] = ids.length

  return { categoryPools, playedTrackIds: [], initialCounts }
}

export function pickFromCategory(
  state: CategoryPoolState,
  categoryId: string,
): { trackId: string, newState: CategoryPoolState } {
  const pool = state.categoryPools[categoryId]
  if (!pool || pool.length === 0)
    throw new Error(`Category "${categoryId}" is exhausted`)

  const [trackId] = pool

  // Remove trackId from EVERY category's pool — the played track disappears from all categories.
  // Keep empty categories in the map so the UI can display them as disabled.
  const newCategoryPools: Record<string, string[]> = {}
  for (const [id, ids] of Object.entries(state.categoryPools))
    newCategoryPools[id] = ids.filter(currentId => currentId !== trackId)

  return {
    trackId,
    newState: {
      categoryPools: newCategoryPools,
      playedTrackIds: [...state.playedTrackIds, trackId],
      initialCounts: state.initialCounts,
    },
  }
}

export function getCategoryCounts(
  state: CategoryPoolState,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [id, ids] of Object.entries(state.categoryPools))
    counts[id] = ids.length
  return counts
}

export function isCategoryPoolExhausted(state: CategoryPoolState): boolean {
  return Object.values(state.categoryPools).every(ids => ids.length === 0)
}
