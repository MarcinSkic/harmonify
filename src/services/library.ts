import type { Category, CategorySet, CategorySetMember, Playlist, Track, TrackAnnotation } from '@/db/schemas'
import type { CsvCategoryRow, CsvSetRow } from '@/lib/csv'
import { db } from '@/db'

type NewPlaylist = Omit<Playlist, 'id' | 'createdAt'>
type NewTrack = Omit<Track, 'id' | 'createdAt'>
type NewCategory = Omit<Category, 'id' | 'createdAt'>

// Playlists

export async function addPlaylist(data: NewPlaylist): Promise<string> {
  const id = crypto.randomUUID()
  await db.playlists.add({ ...data, id, createdAt: Date.now() })
  return id
}

export async function updatePlaylist(updatedPlaylistId: string, data: Partial<Omit<Playlist, 'id' | 'createdAt'>>): Promise<void> {
  await db.playlists.update(updatedPlaylistId, data)
}

export async function deletePlaylist(deletedPlaylistId: string): Promise<void> {
  await db.transaction('rw', db.playlists, db.tracks, async () => {
    await db.playlists.delete(deletedPlaylistId)

    const tracksOnDeletedPlaylist = await db.tracks.where('playlistIds').equals(deletedPlaylistId).toArray()
    for (const track of tracksOnDeletedPlaylist) {
      const existingPlaylists = track.playlistIds.filter(playlistId => playlistId !== deletedPlaylistId)
      if (existingPlaylists.length === 0)
        await db.tracks.delete(track.id)
      else
        await db.tracks.update(track.id, { playlistIds: existingPlaylists })
    }
  })
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  return db.playlists.toArray()
}

// Tracks

export async function addTrack(data: NewTrack): Promise<string> {
  const id = crypto.randomUUID()
  await db.tracks.add({ ...data, id, createdAt: Date.now() })
  return id
}

export async function addTracks(tracks: NewTrack[]): Promise<void> {
  const now = Date.now()
  await db.tracks.bulkAdd(
    tracks.map(t => ({ ...t, id: crypto.randomUUID(), createdAt: now })),
  )
}

export async function updateTrack(id: string, data: Partial<Omit<Track, 'id' | 'createdAt'>>): Promise<void> {
  await db.tracks.update(id, data)
}

export async function deleteTrack(id: string): Promise<void> {
  await db.tracks.delete(id)
}

export async function getTracksByPlaylist(playlistId: string): Promise<Track[]> {
  return db.tracks.where('playlistIds').equals(playlistId).toArray()
}

export async function getTracksByTag(tag: string): Promise<Track[]> {
  return db.tracks.where('tags').equals(tag).toArray()
}

export interface CSVApplyResult {
  updated: number
  notFound: string[]
  previewUrls: string[]
}

export async function applyCSVToPlaylist(
  playlistId: string,
  rows: TrackAnnotation[],
): Promise<CSVApplyResult> {
  const tracks = await db.tracks.where('playlistIds').equals(playlistId).toArray()
  const bySourceId = new Map(tracks.map(t => [t.sourceId, t]))

  const notFound: string[] = []
  const previewUrlSet = new Set<string>()
  let updated = 0

  for (const row of rows) {
    const track = bySourceId.get(row.sourceId)
    if (!track) {
      notFound.push(row.sourceId)
      continue
    }
    const updateData: Partial<Track> = { tags: row.tags, playbackRange: row.playbackRange }
    if (row.enabled !== undefined)
      updateData.enabled = row.enabled
    if (row.previewImageUrl !== undefined) {
      updateData.previewImageUrl = row.previewImageUrl
      previewUrlSet.add(row.previewImageUrl)
    }
    await db.tracks.update(track.id, updateData)
    updated++
  }

  return { updated, notFound, previewUrls: [...previewUrlSet] }
}

export async function getAllTags(): Promise<string[]> {
  const tracks = await db.tracks.toArray()
  const tags = new Set<string>()
  for (const track of tracks) {
    for (const tag of track.tags)
      tags.add(tag)
  }
  return [...tags].sort()
}

// Categories

export async function addCategory(data: NewCategory): Promise<string> {
  const id = crypto.randomUUID()
  await db.categories.add({ ...data, id, createdAt: Date.now() })
  return id
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<Category, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.categories.update(id, data)
}

export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.categorySetMembers, async () => {
    await db.categories.delete(id)
    const members = await db.categorySetMembers.where('categoryId').equals(id).toArray()
    await db.categorySetMembers.bulkDelete(members.map(m => m.id))
  })
}

export async function getAllCategories(): Promise<Category[]> {
  const categories = await db.categories.toArray()
  return categories.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function countTracksMatchingTagFilter(
  tagFilter: string[],
): Promise<number> {
  if (tagFilter.length === 0)
    return 0
  const matchedIds = new Set<string>()
  const tracks = await db.tracks.where('tags').anyOf(tagFilter).toArray()
  for (const track of tracks) {
    if (track.enabled !== false)
      matchedIds.add(track.id)
  }
  return matchedIds.size
}

export async function importCategories(rows: CsvCategoryRow[]): Promise<{ created: number, updated: number }> {
  let created = 0
  let updated = 0
  await db.transaction('rw', db.categories, async () => {
    const existing = await db.categories.toArray()
    const byName = new Map(existing.map(c => [c.displayName, c]))
    for (const row of rows) {
      const match = byName.get(row.displayName)
      if (match) {
        await db.categories.update(match.id, {
          description: row.description,
          tagFilter: row.tagFilter,
          points: row.points,
        })
        updated++
      }
      else {
        await db.categories.add({
          ...row,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        })
        created++
      }
    }
  })
  return { created, updated }
}

// Category Sets

export async function addCategorySet(name: string): Promise<string> {
  const id = crypto.randomUUID()
  await db.categorySets.add({ id, name, createdAt: Date.now() })
  return id
}

export async function updateCategorySet(id: string, data: Partial<Omit<CategorySet, 'id' | 'createdAt'>>): Promise<void> {
  await db.categorySets.update(id, data)
}

export async function deleteCategorySet(id: string): Promise<void> {
  await db.transaction('rw', db.categorySets, db.categorySetMembers, db.playlists, async () => {
    await db.categorySets.delete(id)
    const members = await db.categorySetMembers.where('categorySetId').equals(id).toArray()
    await db.categorySetMembers.bulkDelete(members.map(m => m.id))
    const playlists = await db.playlists.where('categorySetId').equals(id).toArray()
    for (const p of playlists)
      await db.playlists.update(p.id, { categorySetId: undefined })
  })
}

export async function getAllCategorySets(): Promise<CategorySet[]> {
  return db.categorySets.orderBy('name').toArray()
}

// Category Set Members

export async function addCategoryToSet(setId: string, categoryId: string): Promise<void> {
  await db.transaction('rw', db.categorySetMembers, async () => {
    const existing = await db.categorySetMembers.where('categorySetId').equals(setId).toArray()
    const alreadyMember = existing.some(m => m.categoryId === categoryId)
    if (alreadyMember)
      return
    const maxOrder = existing.reduce((acc, m) => Math.max(acc, m.order), -1)
    await db.categorySetMembers.add({
      id: crypto.randomUUID(),
      categorySetId: setId,
      categoryId,
      order: maxOrder + 1,
    })
  })
}

export async function removeCategoryFromSet(setId: string, categoryId: string): Promise<void> {
  const member = await db.categorySetMembers
    .where('categorySetId')
    .equals(setId)
    .filter(m => m.categoryId === categoryId)
    .first()
  if (member)
    await db.categorySetMembers.delete(member.id)
}

export async function moveCategoryInSet(setId: string, categoryId: string, direction: 'up' | 'down'): Promise<void> {
  await db.transaction('rw', db.categorySetMembers, async () => {
    const members = (await db.categorySetMembers.where('categorySetId').equals(setId).toArray())
      .sort((a, b) => a.order - b.order)
    const index = members.findIndex(m => m.categoryId === categoryId)
    if (index === -1)
      return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= members.length)
      return
    const current = members[index]
    const neighbor = members[swapIndex]
    await db.categorySetMembers.update(current.id, { order: neighbor.order })
    await db.categorySetMembers.update(neighbor.id, { order: current.order })
  })
}

export async function getMembersForSet(setId: string): Promise<CategorySetMember[]> {
  const members = await db.categorySetMembers.where('categorySetId').equals(setId).toArray()
  return members.sort((a, b) => a.order - b.order)
}

export async function getCategoriesForSet(setId: string): Promise<Category[]> {
  const members = await getMembersForSet(setId)
  const categories = await db.categories.bulkGet(members.map(m => m.categoryId))
  const result: Category[] = []
  for (let i = 0; i < members.length; i++) {
    const cat = categories[i]
    if (cat)
      result.push(cat)
  }
  return result
}

export async function getCategoriesForPlaylists(playlistIds: string[]): Promise<Category[]> {
  if (playlistIds.length === 0)
    return []

  const playlists = await db.playlists.bulkGet(playlistIds)
  const setIds = [...new Set(
    playlists.flatMap(p => p?.categorySetId ? [p.categorySetId] : []),
  )]

  if (setIds.length === 0)
    return []

  const seenCategoryIds = new Set<string>()
  const result: Category[] = []

  for (const setId of setIds) {
    const members = await getMembersForSet(setId)
    const categories = await db.categories.bulkGet(members.map(m => m.categoryId))
    for (let i = 0; i < members.length; i++) {
      const cat = categories[i]
      if (cat && !seenCategoryIds.has(cat.id)) {
        seenCategoryIds.add(cat.id)
        result.push(cat)
      }
    }
  }

  return result
}

// Category Set CSV

export async function importCategorySet(rows: CsvSetRow[]): Promise<{ created: number, updated: number }> {
  const groupedBySet = new Map<string, CsvSetRow[]>()
  for (const row of rows) {
    if (!groupedBySet.has(row.setName))
      groupedBySet.set(row.setName, [])
    groupedBySet.get(row.setName)!.push(row)
  }

  const allCategories = await db.categories.toArray()
  const categoryByName = new Map(allCategories.map(c => [c.displayName, c]))

  const allSets = await db.categorySets.toArray()
  const setByName = new Map(allSets.map(s => [s.name, s]))

  let created = 0
  let updated = 0

  for (const [setName, setRows] of groupedBySet) {
    let setId: string
    if (setByName.has(setName)) {
      setId = setByName.get(setName)!.id
      updated++
    }
    else {
      setId = await addCategorySet(setName)
      created++
    }

    const sortedRows = [...setRows].sort((a, b) => a.order - b.order)
    for (const row of sortedRows) {
      const category = categoryByName.get(row.categoryName)
      if (!category)
        continue
      await addCategoryToSet(setId, category.id)
    }
  }

  return { created, updated }
}

export async function exportCategorySet(setId: string): Promise<Array<{ category: Category, order: number }>> {
  const members = await getMembersForSet(setId)
  const categories = await db.categories.bulkGet(members.map(m => m.categoryId))
  const result: Array<{ category: Category, order: number }> = []
  for (let i = 0; i < members.length; i++) {
    const cat = categories[i]
    if (cat)
      result.push({ category: cat, order: members[i].order })
  }
  return result
}

export async function exportAllCategorySets(): Promise<Array<{ set: CategorySet, members: Array<{ category: Category, order: number }> }>> {
  const sets = await getAllCategorySets()
  const result = []
  for (const set of sets) {
    const members = await exportCategorySet(set.id)
    result.push({ set, members })
  }
  return result
}
