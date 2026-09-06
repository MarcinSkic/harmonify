import type { Category, CategoryPoolState, FieldMinDistance } from '@/db/schemas'
import type { FieldBag } from '@/lib/categoryPredicate'
import type { MinDistanceChoice } from '@/lib/minDistance'
import { matchesCategory } from '@/lib/categoryPredicate'
import { selectByMinDistance } from '@/lib/minDistance'
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

/**
 * What the spacing rules of the running game need on top of the pool state. Both halves default to
 * empty, and an empty rule list is the identity in `selectByMinDistance`, so a caller that knows
 * nothing about distances — or a game frozen before they existed — keeps playing exactly as before.
 */
export interface CategoryPickContext {
  /**
   * Field bag per track id, for the candidates and for the already played tracks alike. An id
   * missing from here yields an empty bag, which no rule constrains: that is how a game sourced
   * from the local library, which carries no `fields` at all, plays as if the rules were absent.
   */
  fieldsById: Record<string, FieldBag>
  minDistances: FieldMinDistance[]
}

const NO_SPACING: CategoryPickContext = { fieldsById: {}, minDistances: [] }

export function pickFromCategory(
  state: CategoryPoolState,
  categoryId: string,
  context: CategoryPickContext = NO_SPACING,
): {
  trackId: string
  newState: CategoryPoolState
  /** Why this track won — diagnostics only; nothing is persisted or rendered from it yet. */
  selection: MinDistanceChoice<CategoryPoolTrack>
} {
  // The pool was shuffled once in `createCategoryPool` and is not reshuffled here (decision F4.4):
  // the engine takes the first candidate the rules allow, so "first in an already random order" is
  // what keeps the pick uniform among the tracks that are playable this round.
  const candidates: CategoryPoolTrack[] = (state.categoryPools[categoryId] ?? [])
    .map(id => ({ id, fields: context.fieldsById[id] ?? {} }))
  const history = state.playedTrackIds.map(id => context.fieldsById[id] ?? {})

  // No candidate at all means an empty or unknown category — the same condition the explicit
  // emptiness check used to test for, now reported by the engine.
  const selection = selectByMinDistance(candidates, history, context.minDistances)
  if (!selection)
    throw new Error(`Category "${categoryId}" is exhausted`)

  const trackId = selection.track.id

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
    selection,
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
