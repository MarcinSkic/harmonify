export { clearSession, getSession, normalizeBaseUrl, setSession } from './client'
export { computeSubsonicToken, deriveSubsonicCredentials, navidromeSessionSchema } from './credentials'
export type { NavidromeSession } from './credentials'
export { isMixedContent, NavidromeError } from './errors'
export type { NavidromeErrorKind } from './errors'
export { getSongTags, login } from './native'
export type { NativeSong, SubsonicAlbum, SubsonicPlaylist, SubsonicSong } from './schemas'
export {
  getAlbum,
  getAlbums,
  getCoverArtUrl,
  getPlaylist,
  getPlaylists,
  getStreamUrl,
  isVersionTested,
  NAVIDROME_TESTED_RANGE,
  ping,
} from './subsonic'
export type { NavidromeServerInfo } from './subsonic'
