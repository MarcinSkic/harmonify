import type { CategorySet, CategorySetMember } from '@/db/schemas'
import { defineStore } from 'pinia'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { db } from '@/db'
import { LibraryService } from '@/services'

export const useCategorySetsStore = defineStore('categorySets', () => {
  const categorySets = useLiveQuery(
    () => LibraryService.getAllCategorySets(),
    [] as CategorySet[],
  )

  const allMembers = useLiveQuery(
    () => db.categorySetMembers.toArray(),
    [] as CategorySetMember[],
  )

  function getMembersForSet(setId: string): CategorySetMember[] {
    return allMembers.value
      .filter(m => m.categorySetId === setId)
      .sort((a, b) => a.order - b.order)
  }

  async function create(name: string) {
    return LibraryService.addCategorySet(name)
  }

  async function update(id: string, name: string) {
    return LibraryService.updateCategorySet(id, { name })
  }

  async function remove(id: string) {
    return LibraryService.deleteCategorySet(id)
  }

  async function addCategory(setId: string, categoryId: string) {
    return LibraryService.addCategoryToSet(setId, categoryId)
  }

  async function removeCategory(setId: string, categoryId: string) {
    return LibraryService.removeCategoryFromSet(setId, categoryId)
  }

  async function moveUp(setId: string, categoryId: string) {
    return LibraryService.moveCategoryInSet(setId, categoryId, 'up')
  }

  async function moveDown(setId: string, categoryId: string) {
    return LibraryService.moveCategoryInSet(setId, categoryId, 'down')
  }

  return {
    categorySets,
    allMembers,
    getMembersForSet,
    create,
    update,
    remove,
    addCategory,
    removeCategory,
    moveUp,
    moveDown,
  }
})
