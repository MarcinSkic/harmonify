import { z } from 'zod'

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
  enabled: z.boolean().default(true),
  previewImageUrl: z.string().optional(),
  createdAt: z.number(),
})
export type Track = z.infer<typeof trackSchema>

export const playlistSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  source: metadataSourceSchema,
  imageUrl: z.string().optional(),
  createdAt: z.number(),
})
export type Playlist = z.infer<typeof playlistSchema>

export const categorySchema = z.object({
  id: z.uuid(),
  tagFilter: z.array(z.string()).min(1),
  displayName: z.string(),
  description: z.string().optional(),
  points: z.number().optional(),
  order: z.number(),
  enabled: z.boolean(),
  createdAt: z.number(),
})
export type Category = z.infer<typeof categorySchema>

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

// Local game schemas

export const trackPoolStateSchema = z.object({
  availableTrackIds: z.array(z.uuid()),
  playedTrackIds: z.array(z.uuid()),
})
export type TrackPoolState = z.infer<typeof trackPoolStateSchema>

export const categoryPoolStateSchema = z.object({
  categoryPools: z.record(z.uuid(), z.array(z.uuid())),
  playedTrackIds: z.array(z.uuid()),
  initialCounts: z.record(z.uuid(), z.number()),
})
export type CategoryPoolState = z.infer<typeof categoryPoolStateSchema>

export const localGameTeamSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  score: z.number(),
  roundScores: z.array(z.number()),
})
export type LocalGameTeam = z.infer<typeof localGameTeamSchema>

export const localGameGameModeSchema = z.enum(['random', 'category'])
export type LocalGameGameMode = z.infer<typeof localGameGameModeSchema>

export const localGameSettingsSchema = z.object({
  trackDuration: z.number(),
  gameMode: localGameGameModeSchema,
  hostSeesAnswer: z.boolean(),
  maxRounds: z.number().nullable(),
  partialPoints: z.number().default(2),
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
  roundPhase: localGameRoundPhaseSchema,
})
export type LocalGame = z.infer<typeof localGameSchema>
