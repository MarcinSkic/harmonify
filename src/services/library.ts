import type { Category, CategorySet, CategorySetMember, FieldLimitation, FieldMinDistance, Playlist, Track, TrackAnnotation } from '@/db/schemas'
import type { ParsedCategory, ParsedCategorySet } from '@/lib/categoryJson'
import { db } from '@/db'
import { findDuplicateLimitationName, findDuplicateMinDistanceName, findLimitationWithDuplicatePair } from '@/lib/categoryJson'

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

export async function addTracksDeduplicating(newTracks: NewTrack[]): Promise<void> {
  const existing = await db.tracks.toArray()
  const byAudioUrl = new Map(existing.filter(t => t.audioUrl).map(t => [t.audioUrl!, t]))
  const now = Date.now()

  await db.transaction('rw', db.tracks, async () => {
    for (const track of newTracks) {
      const dupe = track.audioUrl ? byAudioUrl.get(track.audioUrl) : undefined
      if (dupe) {
        const added = track.playlistIds.filter(pid => !dupe.playlistIds.includes(pid))
        if (added.length === 0)
          continue
        const newEnabledByPlaylist = { ...dupe.enabledByPlaylist }
        for (const pid of added)
          newEnabledByPlaylist[pid] = true
        await db.tracks.update(dupe.id, {
          playlistIds: [...dupe.playlistIds, ...added],
          enabledByPlaylist: newEnabledByPlaylist,
        })
        dupe.playlistIds = [...dupe.playlistIds, ...added]
        dupe.enabledByPlaylist = newEnabledByPlaylist
      }
      else {
        const id = crypto.randomUUID()
        const full = { ...track, id, createdAt: now }
        await db.tracks.add(full)
        if (track.audioUrl)
          byAudioUrl.set(track.audioUrl, full as Track)
      }
    }
  })
}

export async function updateTrack(id: string, data: Partial<Omit<Track, 'id' | 'createdAt'>>): Promise<void> {
  await db.tracks.update(id, data)
}

export async function setTrackEnabledForPlaylist(id: string, playlistId: string, enabled: boolean): Promise<void> {
  const track = await db.tracks.get(id)
  if (!track)
    return
  await db.tracks.update(id, {
    enabledByPlaylist: { ...track.enabledByPlaylist, [playlistId]: enabled },
  })
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
  const byLocalId = new Map(tracks.map((t) => {
    const slash = t.sourceId.lastIndexOf('/')
    return [slash >= 0 ? t.sourceId.slice(slash + 1) : t.sourceId, t]
  }))

  const notFound: string[] = []
  const previewUrlSet = new Set<string>()
  let updated = 0

  for (const row of rows) {
    const track = bySourceId.get(row.sourceId) ?? byLocalId.get(row.sourceId)
    if (!track) {
      notFound.push(row.sourceId)
      continue
    }
    const updateData: Partial<Track> = { tags: row.tags, playbackRange: row.playbackRange }
    if (row.enabled !== undefined)
      updateData.enabledByPlaylist = { ...track.enabledByPlaylist, [playlistId]: row.enabled }
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
  return db.categories.toArray()
}

/**
 * Upsert keyed by `displayName` (unique in the database): the file is the source of truth and the
 * library its working copy, so a category already stored under that name is overwritten with what
 * the file says. Every writable field is passed explicitly — `undefined` deletes the key in Dexie,
 * which is what makes a file that dropped `points` actually clear it instead of keeping the old
 * value. A name repeated inside one file is a parse error, caught before this point.
 */
export async function importCategories(
  rows: ParsedCategory[],
): Promise<{ created: number, updated: number }> {
  let created = 0
  let updated = 0

  await db.transaction('rw', db.categories, async () => {
    const byName = new Map((await db.categories.toArray()).map(c => [c.displayName, c]))

    for (const row of rows) {
      const existing = byName.get(row.displayName)

      if (existing) {
        await db.categories.update(existing.id, {
          match: row.match,
          description: row.description,
          points: row.points,
        })
        updated++
        continue
      }

      await db.categories.add({ ...row, id: crypto.randomUUID(), createdAt: Date.now() })
      created++
    }
  })

  return { created, updated }
}

// Category Sets

export async function addCategorySet(name: string): Promise<string> {
  const id = crypto.randomUUID()
  await db.categorySets.add({ id, name, valueLimitations: [], minDistances: [], createdAt: Date.now() })
  return id
}

export async function updateCategorySet(id: string, data: Partial<Omit<CategorySet, 'id' | 'createdAt'>>): Promise<void> {
  await db.categorySets.update(id, data)
}

/**
 * Sorts by `name` before writing so the exported JSON is stable across saves. Rejects a duplicate
 * `name` with an error — the UI is expected to catch this earlier, but this is the last line of
 * defense before the array is trusted as one entry per field.
 */
export async function setCategorySetValueLimitations(setId: string, limitations: FieldLimitation[]): Promise<void> {
  const duplicateName = findDuplicateLimitationName(limitations)
  if (duplicateName)
    throw new Error(`Duplicate value limitation "${duplicateName}"`)

  const duplicatePair = findLimitationWithDuplicatePair(limitations)
  if (duplicatePair)
    throw new Error(`Duplicate pair limit "${duplicatePair.duplicate}" in value limitation "${duplicatePair.limitation.name}"`)

  const sorted = [...limitations].sort((a, b) => a.name.localeCompare(b.name))
  await db.categorySets.update(setId, { valueLimitations: sorted })
}

/**
 * Same contract as `setCategorySetValueLimitations`: sorted by `name` so the exported JSON is
 * stable across saves, and a repeated `name` is rejected rather than merged — the engine reads the
 * array as one entry per field (see `src/lib/minDistance.ts`).
 */
export async function setCategorySetMinDistances(setId: string, distances: FieldMinDistance[]): Promise<void> {
  const duplicateName = findDuplicateMinDistanceName(distances)
  if (duplicateName)
    throw new Error(`Duplicate minimum distance "${duplicateName}"`)

  const sorted = [...distances].sort((a, b) => a.name.localeCompare(b.name))
  await db.categorySets.update(setId, { minDistances: sorted })
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

// Category Set exchange

/**
 * Categories are addressed by `displayName`, so a set file only means something next to the
 * category file it was exported with.
 *
 * A set whose every name resolves is written exactly as the file has it — membership replaced,
 * order taken from the array position, which is what makes reordering the file show up in the UI.
 * A set with an unresolvable name is only ever built up, never rebuilt: a new set gets the members
 * that do resolve, an existing one is left exactly as it was and reported in `unchangedSets`.
 * Rebuilding it would silently empty the user's set when the sets file is imported before the
 * categories file.
 */
export async function importCategorySets(
  rows: ParsedCategorySet[],
): Promise<{ created: number, updated: number, unchangedSets: string[], unknownCategories: string[] }> {
  let created = 0
  let updated = 0
  const unchangedSets: string[] = []
  const unknownCategories: string[] = []

  await db.transaction('rw', db.categorySets, db.categorySetMembers, db.categories, async () => {
    const categoryByName = new Map((await db.categories.toArray()).map(c => [c.displayName, c]))
    const setByName = new Map((await db.categorySets.toArray()).map(s => [s.name, s]))

    for (const row of rows) {
      const unknown = row.categories.filter(name => !categoryByName.has(name))
      unknownCategories.push(...unknown)

      const existingSet = setByName.get(row.name)

      if (existingSet && unknown.length > 0) {
        unchangedSets.push(row.name)
        continue
      }

      let setId: string

      if (existingSet) {
        setId = existingSet.id
        const members = await db.categorySetMembers.where('categorySetId').equals(setId).toArray()
        await db.categorySetMembers.bulkDelete(members.map(m => m.id))
        // Both rule arrays are replaced by what the file says: leaving one of them behind would
        // reimport a set as a mix of the file's proportions and the old spacing.
        await db.categorySets.update(setId, {
          valueLimitations: row.valueLimitations,
          minDistances: row.minDistances,
        })
        updated++
      }
      else {
        setId = crypto.randomUUID()
        await db.categorySets.add({ id: setId, name: row.name, valueLimitations: row.valueLimitations, minDistances: row.minDistances, createdAt: Date.now() })
        created++
      }

      let order = 0
      const added = new Set<string>()

      for (const categoryName of row.categories) {
        const category = categoryByName.get(categoryName)
        if (!category || added.has(category.id))
          continue

        added.add(category.id)
        await db.categorySetMembers.add({
          id: crypto.randomUUID(),
          categorySetId: setId,
          categoryId: category.id,
          order: order++,
        })
      }
    }
  })

  return { created, updated, unchangedSets, unknownCategories }
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
