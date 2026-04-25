<script setup lang="ts">
import type { Category, CategorySetMember } from '@/db/schemas'
import { Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCategoriesStore, useCategorySetsStore } from '@/stores'

const props = defineProps<{
  setId: string
  members: CategorySetMember[]
}>()

const open = defineModel<boolean>('open', { required: true })

const categoriesStore = useCategoriesStore()
const categorySetsStore = useCategorySetsStore()

const memberCategoryIds = computed(() => new Set(props.members.map(m => m.categoryId)))

const availableCategories = computed<Category[]>(() =>
  categoriesStore.categories.filter(c => !memberCategoryIds.value.has(c.id)),
)

const adding = ref(new Set<string>())

async function add(categoryId: string) {
  adding.value.add(categoryId)
  try {
    await categorySetsStore.addCategory(props.setId, categoryId)
  }
  finally {
    adding.value.delete(categoryId)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Add categories to set</DialogTitle>
      </DialogHeader>

      <div class="flex max-h-80 flex-col gap-1 overflow-y-auto">
        <div
          v-if="availableCategories.length === 0"
          class="py-4 text-center text-sm text-muted-foreground"
        >
          All categories are already in this set.
        </div>
        <div
          v-for="category in availableCategories"
          :key="category.id"
          class="
            flex items-center gap-2 rounded-md px-2 py-1.5
            hover:bg-muted/50
          "
        >
          <span class="min-w-0 flex-1 truncate text-sm">{{ category.displayName }}</span>
          <span
            v-if="category.points !== undefined"
            class="shrink-0 text-xs text-muted-foreground"
          >
            {{ category.points }} pts
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="size-7 shrink-0"
            :disabled="adding.has(category.id)"
            @click="add(category.id)"
          >
            <Plus class="size-3" />
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
