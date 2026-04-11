import type { CategoryPoolState, Track } from '@/db/schemas'

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function createCategoryPool(tracks: Track[]): CategoryPoolState {
  const tagPools: Record<string, string[]> = {}
  for (const track of tracks) {
    for (const tag of track.tags)
      (tagPools[tag] ??= []).push(track.id)
  }
  for (const tag of Object.keys(tagPools))
    tagPools[tag] = shuffle(tagPools[tag])

  return { tagPools, playedTrackIds: [] }
}

export function pickFromTag(
  state: CategoryPoolState,
  tag: string,
): { trackId: string, newState: CategoryPoolState } {
  const pool = state.tagPools[tag]
  if (!pool || pool.length === 0)
    throw new Error(`Category "${tag}" is exhausted`)

  const [trackId] = pool

  // Remove trackId from EVERY tag's pool — the played track disappears from all categories.
  // Keep empty tags in the map so the UI can display them as disabled.
  const newTagPools: Record<string, string[]> = {}
  for (const [t, ids] of Object.entries(state.tagPools))
    newTagPools[t] = ids.filter(id => id !== trackId)

  return {
    trackId,
    newState: {
      tagPools: newTagPools,
      playedTrackIds: [...state.playedTrackIds, trackId],
    },
  }
}

export function getAllCategories(
  state: CategoryPoolState,
): Array<{ tag: string, count: number }> {
  return Object.entries(state.tagPools)
    .map(([tag, ids]) => ({ tag, count: ids.length }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}

export function isCategoryPoolExhausted(state: CategoryPoolState): boolean {
  return Object.values(state.tagPools).every(ids => ids.length === 0)
}
