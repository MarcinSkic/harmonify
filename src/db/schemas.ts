import { z } from 'zod'
import { localGuessLevelSchema } from '@/types'

export const metadataSourceSchema = z.enum(['spotify', 'server', 'manual', 'csv'])
export type MetadataSource = z.infer<typeof metadataSourceSchema>

export const playbackRangeSchema = z.object({
  startMs: z.number(),
  endMs: z.number(),
})
export type PlaybackRange = z.infer<typeof playbackRangeSchema>

export interface TrackAnnotation {
  sourceId: string
  tags: string[]
  playbackRange: PlaybackRange | null
  enabled?: boolean
  previewImageUrl?: string
}

export const trackSchema = z.object({
  id: z.uuid(),
  sourceId: z.string(),
  name: z.string(),
  artists: z.array(z.string()),
  albumName: z.string(),
  albumImageUrl: z.string().optional(),
  durationMs: z.number(),
  audioUrl: z.string().optional(),
  playbackRange: playbackRangeSchema.nullable(),
  tags: z.array(z.string()),
  playlistIds: z.array(z.uuid()),
  metadataSource: metadataSourceSchema,
  enabledByPlaylist: z.record(z.string(), z.boolean()).default({}),
  previewImageUrl: z.string().optional(),
  createdAt: z.number(),
})
export type Track = z.infer<typeof trackSchema>

export const playlistSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  source: metadataSourceSchema,
  imageUrl: z.string().optional(),
  categorySetId: z.string().optional(),
  createdAt: z.number(),
})
export type Playlist = z.infer<typeof playlistSchema>

export const categorySchema = z.object({
  id: z.uuid(),
  tagFilter: z.array(z.string()).min(1),
  displayName: z.string(),
  description: z.string().optional(),
  points: z.number().optional(),
  createdAt: z.number(),
})
export type Category = z.infer<typeof categorySchema>

export const categorySetSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.number(),
})
export type CategorySet = z.infer<typeof categorySetSchema>

export const categorySetMemberSchema = z.object({
  id: z.uuid(),
  categorySetId: z.uuid(),
  categoryId: z.uuid(),
  order: z.number(),
})
export type CategorySetMember = z.infer<typeof categorySetMemberSchema>

export const playlistBasedCategorySchema = z.object({
  id: z.string(),
  type: z.literal('playlist-based'),
  displayName: z.string(),
  playlistId: z.string(),
  points: z.number(),
})
export type PlaylistBasedCategory = z.infer<typeof playlistBasedCategorySchema>

// Link preview schemas

export const linkPreviewStatusSchema = z.enum(['pending', 'fetched', 'error'])
export type LinkPreviewStatus = z.infer<typeof linkPreviewStatusSchema>

export const linkPreviewSchema = z.object({
  url: z.string(),
  imageBlob: z.instanceof(Blob).optional(),
  status: linkPreviewStatusSchema,
  fetchedAt: z.number().optional(),
  error: z.string().optional(),
  retryCount: z.number().default(0),
  nextRetryAt: z.number().optional(),
})
export type LinkPreview = z.infer<typeof linkPreviewSchema>

// Game result schemas

export const teamRoundScoreSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  points: z.number(),
  result: localGuessLevelSchema,
})
export type TeamRoundScore = z.infer<typeof teamRoundScoreSchema>

export const roundResultSchema = z.object({
  roundNumber: z.number(),
  trackId: z.string(),
  trackSourceId: z.string(),
  trackName: z.string(),
  trackArtists: z.array(z.string()),
  albumName: z.string(),
  albumImageUrl: z.string().optional(),
  previewImageUrl: z.string().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  categoryPoints: z.number().optional(),
  currentTeamId: z.string().optional(),
  currentTeamName: z.string().optional(),
  teamScores: z.array(teamRoundScoreSchema),
})
export type RoundResult = z.infer<typeof roundResultSchema>

export const gameResultSchema = z.object({
  id: z.uuid(),
  createdAt: z.number(),
  finishedAt: z.number(),
  gameMode: z.enum(['random', 'category']),
  teams: z.array(z.object({
    id: z.string(),
    name: z.string(),
    totalScore: z.number(),
  })),
  rounds: z.array(roundResultSchema),
  selectedPlaylistIds: z.array(z.string()),
})
export type GameResult = z.infer<typeof gameResultSchema>

// Local game schemas

export const trackPoolStateSchema = z.object({
  availableTrackIds: z.array(z.uuid()),
  playedTrackIds: z.array(z.uuid()),
})
export type TrackPoolState = z.infer<typeof trackPoolStateSchema>

export const categoryPoolStateSchema = z.object({
  categoryPools: z.record(z.string(), z.array(z.string())),
  playedTrackIds: z.array(z.string()),
  initialCounts: z.record(z.string(), z.number()),
})
export type CategoryPoolState = z.infer<typeof categoryPoolStateSchema>

export const localGameTeamSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  score: z.number(),
  roundScores: z.array(z.number()),
  disabled: z.boolean().default(false),
})
export type LocalGameTeam = z.infer<typeof localGameTeamSchema>

export const localGameGameModeSchema = z.enum(['random', 'category'])
export type LocalGameGameMode = z.infer<typeof localGameGameModeSchema>

export const categoryLimitSchema = z.enum(['none', 'no-streak', 'once'])
export type CategoryLimit = z.infer<typeof categoryLimitSchema>

export const localGameSettingsSchema = z.object({
  trackDuration: z.number(),
  gameMode: localGameGameModeSchema,
  hostSeesAnswer: z.boolean(),
  maxRounds: z.number().nullable(),
  partialPoints: z.number().default(2),
  breakDurationBetweenRounds: z.number().default(3),
  saveGame: z.boolean().default(true),
  showTrackCategories: z.boolean().default(true),
  categoryLimit: categoryLimitSchema.default('none'),
  generatePlaylistCategories: z.boolean().default(false),
  generatedCategoryPoints: z.number().default(10),
  standardPoints: z.number().default(10),
  trackStartMode: z.enum(['beginning', 'random']).default('beginning'),
  randomStartRange: z.tuple([z.number(), z.number()]).default([0, 100]),
  overridePlaybackRange: z.boolean().default(false),
})
export type LocalGameSettings = z.infer<typeof localGameSettingsSchema>

export const localGameStatusSchema = z.enum(['setup', 'playing', 'finished'])
export type LocalGameStatus = z.infer<typeof localGameStatusSchema>

export const localGameRoundPhaseSchema = z.enum(['pickingCategory', 'playing', 'scoring', 'leaderboard'])
export type LocalGameRoundPhase = z.infer<typeof localGameRoundPhaseSchema>

export const localGameSchema = z.object({
  id: z.uuid(),
  createdAt: z.number(),
  status: localGameStatusSchema,
  teams: z.array(localGameTeamSchema),
  settings: localGameSettingsSchema,
  currentRound: z.number(),
  trackPoolState: trackPoolStateSchema,
  categoryPoolState: categoryPoolStateSchema.optional(),
  selectedPlaylistIds: z.array(z.string()),
  currentTrackId: z.string().optional(),
  currentCategory: z.string().optional(),
  currentTeamId: z.string().optional(),
  roundPhase: localGameRoundPhaseSchema,
  rounds: z.array(roundResultSchema).default([]),
  categoryLimitUsedByTeams: z.record(z.string(), z.array(z.string())).optional(),
  ephemeralCategories: z.array(playlistBasedCategorySchema).optional(),
})
export type LocalGame = z.infer<typeof localGameSchema>
