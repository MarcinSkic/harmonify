import { z } from 'zod'

/** Envelope shared by every Subsonic endpoint; the payload itself is validated per endpoint. */
export const subsonicEnvelopeSchema = z.object({
  'subsonic-response': z.object({
    status: z.enum(['ok', 'failed']),
    version: z.string(),
    error: z.object({
      code: z.number(),
      message: z.string().optional(),
    }).loose().optional(),
  }).loose(),
})

export const subsonicPingSchema = z.object({
  type: z.string().optional(),
  serverVersion: z.string().optional(),
}).loose()
export type SubsonicPing = z.infer<typeof subsonicPingSchema>

export const subsonicSongSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string().optional(),
  album: z.string().optional(),
  albumId: z.string().optional(),
  discNumber: z.number().optional(),
  track: z.number().optional(),
  duration: z.number().optional(),
  coverArt: z.string().optional(),
  musicBrainzId: z.string().optional(),
}).loose()
export type SubsonicSong = z.infer<typeof subsonicSongSchema>

export const subsonicAlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string().optional(),
  artistId: z.string().optional(),
  songCount: z.number().optional(),
  duration: z.number().optional(),
  year: z.number().optional(),
  coverArt: z.string().optional(),
}).loose()
export type SubsonicAlbum = z.infer<typeof subsonicAlbumSchema>

export const subsonicPlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  comment: z.string().optional(),
  owner: z.string().optional(),
  songCount: z.number().optional(),
  duration: z.number().optional(),
  coverArt: z.string().optional(),
}).loose()
export type SubsonicPlaylist = z.infer<typeof subsonicPlaylistSchema>

/** Subsonic omits collection fields entirely when they are empty, hence every list is optional. */
export const subsonicAlbumListSchema = z.object({
  albumList2: z.object({
    album: z.array(subsonicAlbumSchema).optional(),
  }).loose(),
})

export const subsonicAlbumWithSongsSchema = z.object({
  album: subsonicAlbumSchema.extend({
    song: z.array(subsonicSongSchema).optional(),
  }),
})

export const subsonicPlaylistsSchema = z.object({
  playlists: z.object({
    playlist: z.array(subsonicPlaylistSchema).optional(),
  }).loose(),
})

export const subsonicPlaylistWithSongsSchema = z.object({
  playlist: subsonicPlaylistSchema.extend({
    entry: z.array(subsonicSongSchema).optional(),
  }),
})

/** Native `/auth/login`; `.loose()` so extra fields of a newer Navidrome do not break parsing. */
export const nativeLoginSchema = z.object({
  token: z.string(),
  username: z.string(),
}).loose()

/**
 * Tags are multi-valued, but Navidrome serialises a lone value as a bare string, so both shapes
 * normalise to `string[]`.
 */
const nativeTagValuesSchema = z.union([z.string(), z.array(z.string())])
  .transform(value => Array.isArray(value) ? value : [value])

/**
 * Native `/api/song/<id>`. `tags` carries `json:"tags,omitempty"` on the server, so a song without
 * custom tags has no such field at all — making it required would report most of a library as
 * "Navidrome changed its API".
 */
export const nativeSongSchema = z.object({
  id: z.string(),
  tags: z.record(z.string(), nativeTagValuesSchema).default({}),
}).loose()
export type NativeSong = z.infer<typeof nativeSongSchema>
