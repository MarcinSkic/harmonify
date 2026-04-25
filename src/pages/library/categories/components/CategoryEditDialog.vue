<script setup lang="ts">
import type { Category } from '@/db/schemas'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'
import { categorySchema } from '@/db/schemas'
import { LibraryService } from '@/services'
import { useCategoriesStore, useLibraryStore } from '@/stores'
import TagMultiSelect from './TagMultiSelect.vue'

const props = defineProps<{
  category: Category | null
}>()

const open = defineModel<boolean>('open', { required: true })

const categoriesStore = useCategoriesStore()
const libraryStore = useLibraryStore()

const isEditMode = computed(() => props.category !== null)

const displayName = ref('')
const description = ref('')
const points = ref<number | null>(null)
const tagFilter = ref<string[]>([])
const matchCount = ref(0)

watch(
  () => [open.value, props.category] as const,
  ([isOpen, category]) => {
    if (!isOpen)
      return
    if (category) {
      displayName.value = category.displayName
      description.value = category.description ?? ''
      points.value = category.points ?? null
      tagFilter.value = [...category.tagFilter]
    }
    else {
      displayName.value = ''
      description.value = ''
      points.value = null
      tagFilter.value = []
    }
  },
  { immediate: true },
)

watch(
  tagFilter,
  async (tags) => {
    matchCount.value = await LibraryService.countTracksMatchingTagFilter(tags)
  },
  { immediate: true },
)

async function handleSubmit() {
  const payload = {
    displayName: displayName.value.trim(),
    description: description.value.trim() || undefined,
    points: points.value ?? undefined,
    tagFilter: tagFilter.value,
  }

  if (!payload.displayName) {
    toast.error('Display name is required')
    return
  }

  const duplicate = categoriesStore.categories.find(
    c => c.displayName === payload.displayName && c.id !== props.category?.id,
  )
  if (duplicate) {
    toast.error(`A category named "${payload.displayName}" already exists`)
    return
  }

  const validation = categorySchema
    .omit({ id: true, createdAt: true })
    .safeParse(payload)

  if (!validation.success) {
    toast.error(validation.error.issues[0]?.message ?? 'Invalid category')
    return
  }

  try {
    if (props.category)
      await categoriesStore.update(props.category.id, validation.data)
    else
      await categoriesStore.create(validation.data)
    open.value = false
  }
  catch (err) {
    toast.error(`Failed to save category: ${(err as Error).message}`)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ isEditMode ? 'Edit category' : 'Add category' }}</DialogTitle>
        <DialogDescription>
          Group one or more tags into a category with display metadata.
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4 py-2" @submit.prevent="handleSubmit">
        <div class="grid gap-2">
          <Label for="category-display-name">Display name</Label>
          <Input
            id="category-display-name"
            v-model="displayName"
            placeholder="e.g. OST"
            autocomplete="off"
          />
        </div>

        <div class="grid gap-2">
          <Label for="category-description">Description</Label>
          <Input
            id="category-description"
            v-model="description"
            placeholder="Optional tooltip shown in the game"
            autocomplete="off"
          />
        </div>

        <div class="grid gap-2">
          <Label>Tags</Label>
          <TagMultiSelect
            v-model="tagFilter"
            :available-tags="libraryStore.allTags"
          />
          <p class="text-xs text-muted-foreground">
            {{ matchCount }} {{ matchCount === 1 ? 'track matches' : 'tracks match' }} these tags
          </p>
        </div>

        <div class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3">
          <Label for="category-points">Points</Label>
          <NumberField
            id="category-points"
            :model-value="points ?? undefined"
            class="w-40"
            @update:model-value="(v) => (points = typeof v === 'number' && !Number.isNaN(v) ? v : null)"
          >
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput placeholder="—" />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </div>
      </form>

      <DialogFooter>
        <Button type="button" variant="ghost" @click="open = false">
          Cancel
        </Button>
        <Button type="button" @click="handleSubmit">
          {{ isEditMode ? 'Save' : 'Create' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
