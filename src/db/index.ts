import type { EntityTable } from 'dexie'
import type { Category, LinkPreview, LocalGame, Playlist, Track } from './schemas'
import Dexie from 'dexie'

export const db = new Dexie('harmonifyLibrary') as Dexie & {
  playlists: EntityTable<Playlist, 'id'>
  tracks: EntityTable<Track, 'id'>
  localGames: EntityTable<LocalGame, 'id'>
  categories: EntityTable<Category, 'id'>
  linkPreviews: EntityTable<LinkPreview, 'url'>
}

db.version(1).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt, enabled',
  localGames: 'id, status, createdAt',
  categories: 'id, order, enabled, *tagFilter',
  linkPreviews: 'url, status, nextRetryAt',
})
