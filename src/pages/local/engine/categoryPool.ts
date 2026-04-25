import type { Category, CategoryPoolState, PlaylistBasedCategory, Track } from '@/db/schemas'

export type EngineCategory = Category | PlaylistBasedCategory

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function isPlaylistBased(category: EngineCategory): category is PlaylistBasedCategory {
  return 'type' in category && category.type === 'playlist-based'
}

export function createCategoryPool(
  tracks: Track[],
  categories: EngineCategory[],
): CategoryPoolState {
  const categoryPools: Record<string, string[]> = {}
  for (const category of categories) {
    let matchingIds: string[]
    if (isPlaylistBased(category)) {
      matchingIds = tracks
        .filter(t => t.playlistIds.includes(category.playlistId))
        .map(t => t.id)
    }
    else {
      const filter = new Set(category.tagFilter)
      matchingIds = tracks
        .filter(t => t.tags.some(tag => filter.has(tag)))
        .map(t => t.id)
    }
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
