import type { EntityTable } from 'dexie'
import type { Category, CategorySet, CategorySetMember, GameResult, LinkPreview, LocalGame, Playlist, Track } from './schemas'
import Dexie from 'dexie'

export const db = new Dexie('harmonifyLibrary') as Dexie & {
  playlists: EntityTable<Playlist, 'id'>
  tracks: EntityTable<Track, 'id'>
  localGames: EntityTable<LocalGame, 'id'>
  categories: EntityTable<Category, 'id'>
  linkPreviews: EntityTable<LinkPreview, 'url'>
  gameResults: EntityTable<GameResult, 'id'>
  categorySets: EntityTable<CategorySet, 'id'>
  categorySetMembers: EntityTable<CategorySetMember, 'id'>
}

db.version(1).stores({
  playlists: 'id, name, source, createdAt',
  tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt, enabled',
  localGames: 'id, status, createdAt',
  categories: 'id, order, enabled, *tagFilter',
  linkPreviews: 'url, status, nextRetryAt',
})

db.version(2)
  .stores({
    categories: 'id, &displayName, order, enabled, *tagFilter',
  })
  .upgrade(async (tx) => {
    const all = await tx.table('categories').toArray()
    const byName = new Map<string, typeof all>()
    for (const cat of all) {
      if (!byName.has(cat.displayName))
        byName.set(cat.displayName, [])
      byName.get(cat.displayName)!.push(cat)
    }
    const toDelete: string[] = []
    for (const [, group] of byName) {
      if (group.length <= 1)
        continue
      group.sort((a: { order: number, createdAt: number }, b: { order: number, createdAt: number }) =>
        a.order - b.order || a.createdAt - b.createdAt)
      toDelete.push(...group.slice(1).map((c: { id: string }) => c.id))
    }
    if (toDelete.length > 0)
      await tx.table('categories').bulkDelete(toDelete)
  })

db.version(3).stores({
  gameResults: 'id, finishedAt',
})

db.version(4)
  .stores({
    categorySets: 'id, name, createdAt',
    categorySetMembers: 'id, categorySetId, categoryId',
    categories: 'id, &displayName, *tagFilter',
    playlists: 'id, name, source, categorySetId, createdAt',
  })
  .upgrade(async (tx) => {
    const cats = await tx.table('categories').toArray()
    for (const cat of cats) {
      const { enabled: _e, order: _o, ...rest } = cat
      await tx.table('categories').put(rest)
    }
  })

db.version(5)
  .stores({
    tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt',
  })
  .upgrade(async (tx) => {
    await tx.table('tracks').toCollection().modify((track) => {
      const enabledByPlaylist: Record<string, boolean> = {}
      for (const pid of track.playlistIds ?? [])
        enabledByPlaylist[pid] = track.enabled !== false
      track.enabledByPlaylist = enabledByPlaylist
      delete track.enabled
    })
  })
