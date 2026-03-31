import { z } from 'zod'

/**
 * Spotify API types
 */

export const imageObjectSchema = z.object({
  url: z.string(),
  height: z.number().nullable(),
  width: z.number().nullable(),
})

export type ImageObject = z.infer<typeof imageObjectSchema>

export function getAlbumSchema<T>(schema: z.ZodType<T>) {
  return z.object({
    id: z.string(),
    images: z.array(imageObjectSchema),
    name: z.string(),
    tracks: z.object({
      items: z.array(schema),
    }),
  })
}
export interface Album<T> {
  id: string
  images: ImageObject[]
  name: string
  tracks: {
    items: T[]
  }
}

export const simplePlaylistObjectSchema = z.object({
  id: z.string(),
  images: z.array(imageObjectSchema).nullable(),
  name: z.string(),
  tracks: z.object({
    href: z.string(),
    total: z.number(),
  }),
})
export type SimplePlaylistObject = z.infer<typeof simplePlaylistObjectSchema>

export const simplifiedTrackObjectSchema = z.object({
  artists: z.array(
    z.object({
      name: z.string(),
      id: z.string(),
    }),
  ),
  duration_ms: z.number(),
  name: z.string(),
  uri: z.string(),
  preview_url: z.url().nullable().optional(),
})
export type SimplifiedTrackObject = z.infer<typeof simplifiedTrackObjectSchema>

/**
 * Spotify types extended with game logic
 */

export const spotifyTrackSchema = simplifiedTrackObjectSchema.extend({
  preview_url: z.url().nullable().optional(),
  album: z.object({
    name: z.string(),
    images: z.array(imageObjectSchema),
  }),
  guess: z.string().optional(),
})
export type SpotifyTrack = z.infer<typeof spotifyTrackSchema>

export const spotifySelectablePlaylistSchema = simplePlaylistObjectSchema.extend({
  selected: z.boolean(),
})
export type SpotifySelectablePlaylist = z.infer<typeof spotifySelectablePlaylistSchema>

export const spotifySelectableAlbumSchema = getAlbumSchema(spotifyTrackSchema).extend({
  selected: z.boolean(),
})
export type SpotifySelectableAlbum = z.infer<typeof spotifySelectableAlbumSchema>
