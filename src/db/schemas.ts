import { z } from 'zod'
import { localGuessLevelSchema } from '@/types'

export const metadataSourceSchema = z.enum(['spotify', 'server', 'manual', 'csv', 'navidrome'])
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

// Track overlay schema (local annotations layered on top of a Navidrome library)

export const trackOverlaySchema = z.object({
  id: z.string(), // deriveOverlayKey() result — table's primary key
  musicBrainzId: z.string().optional(),
  albumId: z.string().optional(),
  discNumber: z.number().optional(),
  track: z.number().optional(),
  title: z.string(),
  artist: z.string().optional(),
  playbackRange: playbackRangeSchema.nullable(),
  previewImageUrl: z.string().optional(),
  enabled: z.boolean().default(true),
  customFields: z.record(z.string(), z.string()).default({}),
  updatedAt: z.number(),
})
export type TrackOverlay = z.infer<typeof trackOverlaySchema>

// Overlay field registry — the user-defined metadata fields a category predicate can read
// alongside Navidrome tags. Name + type only: no aliases, no value validation rules.

export const overlayFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['text', 'number']),
  createdAt: z.number(),
})
export type OverlayField = z.infer<typeof overlayFieldSchema>

export const playlistSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  source: metadataSourceSchema,
  imageUrl: z.string().optional(),
  categorySetId: z.string().optional(),
  createdAt: z.number(),
})
export type Playlist = z.infer<typeof playlistSchema>

// Category predicate schemas — the grammar a category matches metadata with. One level only:
// no nesting, no `z.lazy`. Semantics of every operator live in `src/lib/categoryPredicate.ts`.

/**
 * Operand map of a single condition: exactly one field name → operand. An empty map (nothing to
 * test) or several fields (an implicit, unwritten conjunction) are parse errors, never silently
 * accepted — the evaluator reads one pair and one pair only.
 */
function conditionOperandMap<TOperand extends z.ZodType>(operand: TOperand) {
  return z.record(z.string().min(1), operand)
    .refine(map => Object.keys(map).length === 1, { message: 'Condition must name exactly one field' })
}

/**
 * `z.strictObject` on every variant is deliberate and accepted at the plan level: a condition that
 * names two operators (`{ is: …, gt: … }`) is **rejected**, not parsed as the first one with the
 * rest silently dropped. The JSON import of §8 inherits that — such an element is a row error.
 * Do not relax it to `z.object` to make an import "more forgiving".
 */
export const conditionSchema = z.union([
  z.strictObject({ is: conditionOperandMap(z.string()) }),
  z.strictObject({ isNot: conditionOperandMap(z.string()) }),
  z.strictObject({ gt: conditionOperandMap(z.number()) }),
  z.strictObject({ lt: conditionOperandMap(z.number()) }),
  z.strictObject({ contains: conditionOperandMap(z.string()) }),
  z.strictObject({ inTheRange: conditionOperandMap(z.tuple([z.number(), z.number()])) }),
  z.strictObject({ isMissing: conditionOperandMap(z.boolean()) }),
  z.strictObject({ isPresent: conditionOperandMap(z.boolean()) }),
])
export type Condition = z.infer<typeof conditionSchema>

export const categoryMatchSchema = z.union([
  z.strictObject({ all: z.array(conditionSchema).min(1) }),
  z.strictObject({ any: z.array(conditionSchema).min(1) }),
])
export type CategoryMatch = z.infer<typeof categoryMatchSchema>

export const categorySchema = z.object({
  id: z.uuid(),
  match: categoryMatchSchema,
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
  selectedPlaylists: z.array(z.object({ id: z.string(), name: z.string(), imageUrl: z.string().optional() })),
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

// Navidrome game source schemas, needed here so `localGameSchema` can freeze a Navidrome-sourced
// pool inside a `LocalGame`

export const navidromeGameSourceRefSchema = z.object({
  type: z.enum(['album', 'playlist']),
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().optional(),
})
export type NavidromeGameSourceRef = z.infer<typeof navidromeGameSourceRefSchema>

export const frozenNavidromeTrackSchema = z.object({
  // song.id — an ephemeral handle, only valid for the lifetime of this frozen game (see the note on
  // `materializePool` in `src/services/navidromeGameSource.ts`)
  id: z.string(),
  overlayKey: z.string(),
  title: z.string(),
  artist: z.string().optional(),
  albumName: z.string().optional(),
  albumId: z.string().optional(),
  coverArt: z.string().optional(),
  durationMs: z.number().optional(),
  playbackRange: playbackRangeSchema.nullable(),
  previewImageUrl: z.string().optional(),
  /**
   * Navidrome tags ∪ overlay fields — what a category predicate is evaluated against.
   *
   * Games frozen before this field existed have **no** `fields` at all: `localGameSchema` is never
   * used as a parser (games are read straight out of Dexie), so this `.default({})` does not fire on
   * read. Anything reading `fields` off a stored game must write `track.fields ?? {}`.
   */
  fields: z.record(z.string(), z.array(z.string())).default({}),
})
export type FrozenNavidromeTrack = z.infer<typeof frozenNavidromeTrackSchema>

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
  takeoverTeamId: z.string().optional(),
  roundPhase: localGameRoundPhaseSchema,
  rounds: z.array(roundResultSchema).default([]),
  categoryLimitUsedByTeams: z.record(z.string(), z.array(z.string())).optional(),
  ephemeralCategories: z.array(playlistBasedCategorySchema).optional(),
  source: z.enum(['library', 'navidrome']).optional(), // missing = pre-migration game
  navidromeTracks: z.record(z.string(), frozenNavidromeTrackSchema).optional(), // keyed by song.id
  navidromeSources: z.array(navidromeGameSourceRefSchema).optional(),
})
export type LocalGame = z.infer<typeof localGameSchema>
