import type { TrackPoolState } from '@/db/schemas'

export function createPool(trackIds: string[]): TrackPoolState {
  const shuffled = [...trackIds]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return {
    availableTrackIds: shuffled,
    playedTrackIds: [],
  }
}

export function pickRandom(state: TrackPoolState): { trackId: string, newState: TrackPoolState } {
  if (state.availableTrackIds.length === 0) {
    throw new Error('Track pool is exhausted')
  }

  const [trackId, ...rest] = state.availableTrackIds

  return {
    trackId,
    newState: {
      availableTrackIds: rest,
      playedTrackIds: [...state.playedTrackIds, trackId],
    },
  }
}

export function isExhausted(state: TrackPoolState): boolean {
  return state.availableTrackIds.length === 0
}
