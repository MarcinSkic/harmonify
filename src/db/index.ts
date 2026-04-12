import type { EntityTable } from 'dexie'
import type { Category, LocalGame, Playlist, Track } from './schemas'
import Dexie from 'dexie'

export const db = new Dexie('harmonifyLibrary') as Dexie & {
  playlists: EntityTable<Playlist, 'id'>
  tracks: EntityTable<Track, 'id'>
  localGames: EntityTable<LocalGame, 'id'>
  categories: EntityTable<Category, 'id'>
}

db.version(1).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt',
})

db.version(2).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt',
  localGames: 'id, status, createdAt',
})

db.version(3).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt',
  localGames: 'id, status, createdAt',
  categories: 'id, order, enabled, *tagFilter',
})

db.version(4).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt, enabled',
  localGames: 'id, status, createdAt',
  categories: 'id, order, enabled, *tagFilter',
}).upgrade(tx => tx.table('tracks').toCollection().modify((track) => {
  if (track.enabled === undefined)
    track.enabled = true
}))
