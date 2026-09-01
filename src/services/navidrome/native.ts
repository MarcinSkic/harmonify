import { nativeFetch } from './client'
import { nativeLoginSchema, nativeSongSchema } from './schemas'

/**
 * The native API is the unstable one, so it carries exactly two calls: logging in and reading a
 * song's custom tags. Everything else goes through Subsonic.
 */
export async function login(baseUrl: string, username: string, password: string): Promise<{ jwt: string, username: string }> {
  const payload = await nativeFetch('/auth/login', nativeLoginSchema, {
    baseUrl,
    method: 'POST',
    body: { username, password },
  })

  return { jwt: payload.token, username: payload.username }
}

/** Tag name → list of values; a song without custom tags yields an empty map. */
export async function getSongTags(songId: string): Promise<Record<string, string[]>> {
  const song = await nativeFetch(`/api/song/${encodeURIComponent(songId)}`, nativeSongSchema)

  return song.tags
}
