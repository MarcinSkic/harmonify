import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

/**
 * `db.version(7)` is the only irreversible operation of the category-predicate migration: it deletes
 * the user's categories, because a `tagFilter` (tags of the old Harmonify library) cannot be turned
 * into a `<field> <operator> <value>` predicate over Navidrome fields. What it must *not* touch is
 * anything else — hence this test.
 */
describe('db.version(7) upgrade', () => {
  it('deletes categories and their set members, leaving sets, games and the new table intact', async () => {
    const before = new Dexie('harmonifyLibrary')
    before.version(6).stores({
      playlists: 'id, name, source, categorySetId, createdAt',
      tracks: 'id, sourceId, name, *playlistIds, *tags, metadataSource, createdAt',
      localGames: 'id, status, createdAt',
      categories: 'id, &displayName, *tagFilter',
      linkPreviews: 'url, status, nextRetryAt',
      gameResults: 'id, finishedAt',
      categorySets: 'id, name, createdAt',
      categorySetMembers: 'id, categorySetId, categoryId',
      trackOverlays: 'id',
    })
    await before.open()
    await before.table('categories').add({ id: 'c1', displayName: 'Old', tagFilter: ['op'], createdAt: 1 })
    await before.table('categorySets').bulkAdd([
      { id: 'set-with-member', name: 'Konkurs', createdAt: 1 },
      { id: 'set-empty', name: 'Pusty', createdAt: 1 },
    ])
    await before.table('categorySetMembers').add({ id: 'm1', categorySetId: 'set-with-member', categoryId: 'c1', order: 0 })
    await before.table('localGames').add({ id: 'g1', status: 'playing', createdAt: 1 })
    before.close()

    const { db } = await import('../index')
    await db.open()

    expect(await db.categories.count()).toBe(0)
    expect(await db.categorySetMembers.count()).toBe(0)
    // Named sets survive the migration even when everything they held is gone.
    expect((await db.categorySets.toArray()).map(s => s.id).sort()).toEqual(['set-empty', 'set-with-member'])
    // Games are deliberately kept, even though a category game started before the migration can no
    // longer resolve its categories.
    expect(await db.localGames.count()).toBe(1)

    await db.overlayFields.add({ name: 'popularity', type: 'number', createdAt: 1 })
    expect(await db.overlayFields.get('popularity')).toEqual({ name: 'popularity', type: 'number', createdAt: 1 })

    db.close()
  })
})
