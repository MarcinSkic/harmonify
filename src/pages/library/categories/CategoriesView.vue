<script setup lang="ts">
import type { Category } from '@/db/schemas'
import { ArrowLeft, Layers, Plus, Search } from '@lucide/vue'
import { computed, ref, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCategoriesStore, useLibraryStore } from '@/stores'
import CategoryCard from './components/CategoryCard.vue'
import CategoryCsvExportButton from './components/CategoryCsvExportButton.vue'
import CategoryCsvImportButton from './components/CategoryCsvImportButton.vue'
import CategoryEditDialog from './components/CategoryEditDialog.vue'

const categoriesStore = useCategoriesStore()
const libraryStore = useLibraryStore()

const search = ref('')
const editOpen = ref(false)
const editing = shallowRef<Category | null>(null)

const filteredCategories = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return categoriesStore.categories
  return categoriesStore.categories.filter(c =>
    c.displayName.toLowerCase().includes(q),
  )
})

const trackCounts = computed(() => {
  const map = new Map<string, number>()
  for (const category of categoriesStore.categories) {
    const tagSet = new Set(category.tagFilter)
    const ids = new Set<string>()
    for (const track of libraryStore.tracks) {
      if (track.tags.some(tag => tagSet.has(tag)))
        ids.add(track.id)
    }
    map.set(category.id, ids.size)
  }
  return map
})

function openCreate() {
  editing.value = null
  editOpen.value = true
}

function openEdit(category: Category) {
  editing.value = category
  editOpen.value = true
}

async function handleDelete(id: string) {
  await categoriesStore.remove(id)
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex flex-wrap items-center gap-3 border-b p-4">
      <RouterLink :to="{ name: 'library' }">
        <Button variant="ghost" size="icon">
          <ArrowLeft class="size-5" />
        </Button>
      </RouterLink>

      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-bold">
          Categories
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ categoriesStore.categories.length }}
          {{ categoriesStore.categories.length === 1 ? 'category' : 'categories' }}
        </p>
      </div>

      <RouterLink :to="{ name: 'categorySets' }">
        <Button variant="outline" class="gap-2">
          <Layers class="size-4" />
          <span
            class="
              hidden
              sm:inline
            "
          >Manage Sets</span>
        </Button>
      </RouterLink>
      <CategoryCsvImportButton />
      <CategoryCsvExportButton />
      <Button class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        Add category
      </Button>
    </header>

    <div class="min-h-0 flex-1 overflow-auto p-4">
      <div class="flex flex-col gap-4">
        <div class="relative">
          <Search
            class="
              pointer-events-none absolute top-1/2 left-3 size-4
              -translate-y-1/2 text-muted-foreground
            "
          />
          <Input
            v-model="search"
            placeholder="Search categories..."
            class="pl-9"
          />
        </div>

        <div
          v-if="categoriesStore.categories.length === 0"
          class="
            flex flex-col items-center gap-3 rounded-lg border border-dashed p-8
            text-center text-muted-foreground
          "
        >
          <p>No categories yet.</p>
          <p class="text-sm">
            Create one to decorate a group of tags with a display name, points,
            and ordering.
          </p>
          <Button class="mt-2 gap-2" @click="openCreate">
            <Plus class="size-4" />
            Create first category
          </Button>
        </div>

        <div
          v-else-if="filteredCategories.length === 0"
          class="
            rounded-lg border border-dashed p-6 text-center
            text-muted-foreground
          "
        >
          No categories match "{{ search }}".
        </div>

        <div
          v-else
          class="
            grid grid-cols-1 gap-3
            sm:grid-cols-2
            lg:grid-cols-3
            xl:grid-cols-4
          "
        >
          <CategoryCard
            v-for="category in filteredCategories"
            :key="category.id"
            :category="category"
            :track-count="trackCounts.get(category.id) ?? 0"
            @edit="openEdit(category)"
            @delete="handleDelete(category.id)"
          />
        </div>
      </div>
    </div>

    <CategoryEditDialog v-model:open="editOpen" :category="editing" />
  </div>
</template>
