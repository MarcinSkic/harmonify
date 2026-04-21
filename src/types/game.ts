import { z } from 'zod'
import { spotifyTrackSchema } from './spotify'

/**
 * Guess levels
 */

export const guessLevelSchema = z.enum(['full', 'album', 'artist', 'none', 'disconnected', 'stolen'])
export type GuessLevel = z.infer<typeof guessLevelSchema>

/**
 * Harmonify API
 */

export const nicknameSchema = z.string().min(2, { message: 'Username must contain at least 2 characters' }).max(50, { message: 'Username must contain at most 50 characters' })

export const playerDtoSchema = z.object({
  guid: z.string(),
  nickname: nicknameSchema,
  connected: z.boolean(),
})
export type PlayerDto = z.infer<typeof playerDtoSchema>

export const playerSchema = playerDtoSchema.extend({
  isHost: z.boolean(),
})
export type Player = z.infer<typeof playerSchema>

export const createdGameDtoSchema = z.object({
  gameId: z.string().length(4),
  hostGuid: z.uuid(),
  nickname: z.string(),
})
export type CreatedGameDto = z.infer<typeof createdGameDtoSchema>

export const gameSettingsDtoSchema = z.object({
  breakDurationBetweenTrackPlays: z.number(),
  breakDurationBetweenRounds: z.number(),
  trackDuration: z.number(),
  roundDuration: z.number(),
  roundCount: z.number(),
  trackStartLowerBound: z.number(),
  trackStartUpperBound: z.number(),
})
export type GameSettingsDto = z.infer<typeof gameSettingsDtoSchema>

export const displayedGuessDtoSchema = z.object({
  guess: z.string(),
  id: z.string(),
})
export type DisplayedGuessDto = z.infer<typeof displayedGuessDtoSchema>

export const gameStartedDtoSchema = z.object({
  possibleGuesses: z.array(displayedGuessDtoSchema),
  gameSettings: gameSettingsDtoSchema,
  roundStartTimestamp: z.number(),
  trackStart_ms: z.number(),
  uri: z.string(),
  preview_url: z.string(),
})
export type GameStartedDto = z.infer<typeof gameStartedDtoSchema>

export const roundResultDtoSchema = z.object({
  score: z.number(),
  guess: z.string(),
  guessLevel: guessLevelSchema,
})
export type RoundResultDto = z.infer<typeof roundResultDtoSchema>

export const roundStartedDto = z.object({
  roundNumber: z.number(),
  roundStartTimestamp: z.number(),
  trackStart_ms: z.number(),
  uri: z.string(),
  preview_url: z.string(),
})
export type RoundStartedDto = z.infer<typeof roundStartedDto>

export const playerScoreDtoSchema = z.object({
  guid: z.string(),
  nickname: nicknameSchema,
  score: z.number(),
  roundResults: z.array(roundResultDtoSchema),
})
export type PlayerScoreDto = z.infer<typeof playerScoreDtoSchema>

export const roundFinishedDto = z.object({
  track: spotifyTrackSchema,
  players: z.array(playerScoreDtoSchema),
})
export type RoundFinishedDto = z.infer<typeof roundFinishedDto>

export const endGameResultsDtoSchema = z.object({
  tracks: z.array(spotifyTrackSchema),
  players: z.array(playerScoreDtoSchema),
})
export type EndGameResultsDto = z.infer<typeof endGameResultsDtoSchema>

/**
 * Game types
 */

export const musicPlayDataSchema = z.object({
  uri: z.string(),
  trackStart_ms: z.number(),
})
export type MusicPlayData = z.infer<typeof musicPlayDataSchema>
