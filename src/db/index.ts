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
