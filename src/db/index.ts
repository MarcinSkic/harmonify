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

db.version(5).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt, enabled',
  localGames: 'id, status, createdAt',
  categories: 'id, order, enabled, *tagFilter',
  linkPreviews: 'url, status, nextRetryAt',
})

db.version(6).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt, enabled',
  localGames: 'id, status, createdAt',
  categories: 'id, order, enabled, *tagFilter',
  linkPreviews: 'url, status, nextRetryAt',
}).upgrade(tx => tx.table('tracks').toCollection().modify((track) => {
  if (track.previewPageUrl !== undefined) {
    track.previewImageUrl = track.previewPageUrl
    delete track.previewPageUrl
  }
}))

db.version(7).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt, enabled',
  localGames: 'id, status, createdAt',
  categories: 'id, order, enabled, *tagFilter',
  linkPreviews: 'url, status, nextRetryAt',
}).upgrade(tx => tx.table('localGames').toCollection().modify((game) => {
  if (game.categoryPoolState && !game.categoryPoolState.initialCounts) {
    const initialCounts: Record<string, number> = {}
    for (const [id, ids] of Object.entries(game.categoryPoolState.categoryPools))
      initialCounts[id] = (ids as string[]).length
    game.categoryPoolState.initialCounts = initialCounts
  }
}))
