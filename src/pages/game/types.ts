import type { MusicPlayData } from '@/types'
import { z } from 'zod'
import { guessLevelSchema } from '@/types'
import { spotifyTrackSchema } from '@/types/spotify'

export const spotifyPlayedTrackSchema = z.object({
  track: spotifyTrackSchema,
  userGuess: z.string(),
  guessLevel: guessLevelSchema,
  score: z.number(),
})
export type SpotifyPlayedTrack = z.infer<typeof spotifyPlayedTrackSchema>

export interface MusicPlayer {
  _turnOn: () => Promise<void>
  _preload: (track: MusicPlayData) => Promise<void>
  _play: (track: MusicPlayData) => Promise<void>
  _seek: (time_ms: number) => Promise<void>
  _resume: () => Promise<void>
  _pause: () => Promise<void>
  /**
   * @param volume in range 0 to 1
   * @returns
   */
  _setVolume: (volume: number) => Promise<void>
}
