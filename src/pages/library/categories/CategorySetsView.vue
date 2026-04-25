<script setup lang="ts">
import type { CategorySet } from '@/db/schemas'
import { ArrowLeft, Plus } from '@lucide/vue'
import { shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useCategorySetsStore } from '@/stores'
import CategorySetCard from './components/CategorySetCard.vue'
import CategorySetCsvExportButton from './components/CategorySetCsvExportButton.vue'
import CategorySetCsvImportButton from './components/CategorySetCsvImportButton.vue'
import CategorySetEditDialog from './components/CategorySetEditDialog.vue'

const categorySetsStore = useCategorySetsStore()

const editOpen = shallowRef(false)
const editing = shallowRef<CategorySet | null>(null)

function openCreate() {
  editing.value = null
  editOpen.value = true
}

function openEdit(categorySet: CategorySet) {
  editing.value = categorySet
  editOpen.value = true
}

async function handleDelete(id: string) {
  await categorySetsStore.remove(id)
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex flex-wrap items-center gap-3 border-b p-4">
      <RouterLink :to="{ name: 'libraryCategories' }">
        <Button variant="ghost" size="icon">
          <ArrowLeft class="size-5" />
        </Button>
      </RouterLink>

      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-bold">
          Category Sets
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ categorySetsStore.categorySets.length }}
          {{ categorySetsStore.categorySets.length === 1 ? 'set' : 'sets' }}
        </p>
      </div>

      <CategorySetCsvImportButton />
      <CategorySetCsvExportButton />
      <Button class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        New set
      </Button>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <div class="mx-auto flex max-w-3xl flex-col gap-4">
        <div
          v-if="categorySetsStore.categorySets.length === 0"
          class="
            flex flex-col items-center gap-3 rounded-lg border border-dashed p-8
            text-center text-muted-foreground
          "
        >
          <p>No category sets yet.</p>
          <p class="text-sm">
            Create a set and assign it to a playlist. The game will use its
            categories when that playlist is selected.
          </p>
          <Button class="mt-2 gap-2" @click="openCreate">
            <Plus class="size-4" />
            Create first set
          </Button>
        </div>

        <CategorySetCard
          v-for="set in categorySetsStore.categorySets"
          :key="set.id"
          :category-set="set"
          :members="categorySetsStore.getMembersForSet(set.id)"
          @edit="openEdit(set)"
          @delete="handleDelete(set.id)"
        />
      </div>
    </div>

    <CategorySetEditDialog v-model:open="editOpen" :category-set="editing" />
  </div>
</template>
