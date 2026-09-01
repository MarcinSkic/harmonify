import type { SubsonicAlbum, SubsonicPlaylist, SubsonicSong } from './schemas'
import { buildSubsonicUrl, subsonicFetch } from './client'
import { NavidromeError } from './errors'
import {
  subsonicAlbumListSchema,
  subsonicAlbumWithSongsSchema,
  subsonicPingSchema,
  subsonicPlaylistsSchema,
  subsonicPlaylistWithSongsSchema,
} from './schemas'

/** Range verified by hand when the phase was accepted — a documented knob, not a constant forever. */
export const NAVIDROME_TESTED_RANGE = { min: '0.54.0', maxExclusive: '0.64.0' } as const

const DEFAULT_ALBUM_PAGE_SIZE = 100

export interface NavidromeServerInfo {
  serverVersion: string
  type: string
}

/** Doubles as the credentials test and the version probe. */
export async function ping(): Promise<NavidromeServerInfo> {
  const payload = await pingResponse()
  const type = payload.type ?? ''

  if (type !== 'navidrome')
    throw new NavidromeError('notNavidrome', type || 'missing type field')

  return { serverVersion: payload.serverVersion ?? '', type }
}

/**
 * A 404 is narrowed to `notNavidrome` **only here**: no Subsonic API answers at this address at all
 * (typing in the address of the app itself is the usual way to get here). On every other endpoint a
 * 404 keeps meaning what it says — an id that does not exist.
 */
async function pingResponse() {
  try {
    return await subsonicFetch('/rest/ping.view', subsonicPingSchema)
  }
  catch (error) {
    if (error instanceof NavidromeError && error.status === 404)
      throw new NavidromeError('notNavidrome', 'no Subsonic API at this address')

    throw error
  }
}

export async function getAlbums({ offset = 0, size = DEFAULT_ALBUM_PAGE_SIZE } = {}): Promise<SubsonicAlbum[]> {
  const payload = await subsonicFetch('/rest/getAlbumList2.view', subsonicAlbumListSchema, {
    type: 'alphabeticalByName',
    offset,
    size,
  })

  return payload.albumList2.album ?? []
}

export async function getAlbum(id: string): Promise<{ album: SubsonicAlbum, songs: SubsonicSong[] }> {
  const payload = await subsonicFetch('/rest/getAlbum.view', subsonicAlbumWithSongsSchema, { id })
  const { song, ...album } = payload.album

  return { album, songs: song ?? [] }
}

export async function getPlaylists(): Promise<SubsonicPlaylist[]> {
  const payload = await subsonicFetch('/rest/getPlaylists.view', subsonicPlaylistsSchema)

  return payload.playlists.playlist ?? []
}

export async function getPlaylist(id: string): Promise<{ playlist: SubsonicPlaylist, songs: SubsonicSong[] }> {
  const payload = await subsonicFetch('/rest/getPlaylist.view', subsonicPlaylistWithSongsSchema, { id })
  const { entry, ...playlist } = payload.playlist

  return { playlist, songs: entry ?? [] }
}

/** Auth travels in the query string, so the URL can be handed straight to an `<audio>` element. */
export function getStreamUrl(songId: string): string {
  return buildSubsonicUrl('/rest/stream.view', { id: songId })
}

export function getCoverArtUrl(id: string, size?: number): string {
  return buildSubsonicUrl('/rest/getCoverArt.view', { id, size })
}

type VersionParts = [number, number, number]

function parseVersion(version: string): VersionParts | null {
  const match = /^\s*v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(version)

  if (!match)
    return null

  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
}

function compareVersions(left: VersionParts, right: VersionParts): number {
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i])
      return left[i] - right[i]
  }

  return 0
}

/**
 * Out of range means a warning, never a block — the native API is the unstable part and an untested
 * version is a heads-up, not a failure. An unparseable version counts as untested.
 */
export function isVersionTested(version: string): boolean {
  const parsed = parseVersion(version)
  const min = parseVersion(NAVIDROME_TESTED_RANGE.min)
  const maxExclusive = parseVersion(NAVIDROME_TESTED_RANGE.maxExclusive)

  if (!parsed || !min || !maxExclusive)
    return false

  return compareVersions(parsed, min) >= 0 && compareVersions(parsed, maxExclusive) < 0
}
