import type { Category } from '@/db/schemas'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { LibraryService } from '@/services'

type NewCategoryInput = Omit<Category, 'id' | 'createdAt' | 'order'>

export const useCategoriesStore = defineStore('categories', () => {
  const categories = useLiveQuery(
    () => LibraryService.getAllCategories(),
    [] as Category[],
  )

  const enabledCategories = computed(() =>
    categories.value.filter(c => c.enabled),
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

  async function moveUp(id: string) {
    return LibraryService.moveCategory(id, 'up')
  }

  async function moveDown(id: string) {
    return LibraryService.moveCategory(id, 'down')
  }

  async function toggleEnabled(id: string) {
    const category = categories.value.find(c => c.id === id)
    if (!category)
      return
    return LibraryService.updateCategory(id, { enabled: !category.enabled })
  }

  return {
    categories,
    enabledCategories,
    create,
    update,
    remove,
    moveUp,
    moveDown,
    toggleEnabled,
  }
})
