import type { Category } from '@/db/schemas'
import { defineStore } from 'pinia'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { LibraryService } from '@/services'

type NewCategoryInput = Omit<Category, 'id' | 'createdAt'>

export const useCategoriesStore = defineStore('categories', () => {
  const categories = useLiveQuery(
    () => LibraryService.getAllCategories(),
    [] as Category[],
  )

  async function create(data: NewCategoryInput) {
    return LibraryService.addCategory(data)
  }

  async function update(
    id: string,
    patch: Partial<Omit<Category, 'id' | 'createdAt'>>,
  ) {
    return LibraryService.updateCategory(id, patch)
  }

  async function remove(id: string) {
    return LibraryService.deleteCategory(id)
  }

  return {
    categories,
    create,
    update,
    remove,
  }
})
