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
