<script setup lang="ts">
import type { Category, CategorySetMember } from '@/db/schemas'
import { ArrowDown, ArrowUp, X } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useCategoriesStore, useCategorySetsStore } from '@/stores'

const props = defineProps<{
  setId: string
  members: CategorySetMember[]
}>()

const categoriesStore = useCategoriesStore()
const categorySetsStore = useCategorySetsStore()

const memberCategories = computed<Array<{ member: CategorySetMember, category: Category | undefined }>>(() =>
  props.members.map(m => ({
    member: m,
    category: categoriesStore.categories.find(c => c.id === m.categoryId),
  })),
)

async function moveUp(categoryId: string) {
  await categorySetsStore.moveUp(props.setId, categoryId)
}

async function moveDown(categoryId: string) {
  await categorySetsStore.moveDown(props.setId, categoryId)
}

async function remove(categoryId: string) {
  await categorySetsStore.removeCategory(props.setId, categoryId)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-if="members.length === 0"
      class="py-3 text-center text-sm text-muted-foreground"
    >
      No categories in this set.
    </div>
    <div
      v-for="(item, index) in memberCategories"
      :key="item.member.id"
      class="
        flex items-center gap-2 rounded-md px-2 py-1
        hover:bg-muted/50
      "
    >
      <div class="flex flex-col gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-6"
          :disabled="index === 0"
          @click="moveUp(item.member.categoryId)"
        >
          <ArrowUp class="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-6"
          :disabled="index === members.length - 1"
          @click="moveDown(item.member.categoryId)"
        >
          <ArrowDown class="size-3" />
        </Button>
      </div>
      <span class="min-w-0 flex-1 truncate text-sm">
        {{ item.category?.displayName ?? item.member.categoryId }}
      </span>
      <span
        v-if="item.category?.points !== undefined"
        class="text-xs text-muted-foreground"
      >
        {{ item.category.points }} pts
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-7 shrink-0"
        @click="remove(item.member.categoryId)"
      >
        <X class="size-3" />
      </Button>
    </div>
  </div>
</template>
