<script setup lang="ts">
import type { CategorySet, FieldMinDistance } from '@/db/schemas'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import SuggestInput from '@/components/SuggestInput.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'
import { useNavidromeTagIndex } from '@/composables/useNavidromeTagIndex'
import { fieldMinDistanceSchema } from '@/db/schemas'
import { useCategorySetsStore, useOverlayFieldsStore } from '@/stores'

const props = defineProps<{
  categorySet: CategorySet
  minDistance: FieldMinDistance | null
}>()

const open = defineModel<boolean>('open', { required: true })

const categorySetsStore = useCategorySetsStore()
const overlayFieldsStore = useOverlayFieldsStore()
const { tagNames, load: loadTagIndex } = useNavidromeTagIndex()

loadTagIndex()

const fieldSuggestions = computed(() => {
  const names = new Set([
    ...tagNames.value,
    ...overlayFieldsStore.overlayFields.map(field => field.name),
  ])
  return [...names].sort((a, b) => a.localeCompare(b))
})

const isEditMode = computed(() => props.minDistance !== null)

/**
 * `null` while adding a new entry. While editing, this is the entry's `name` at the moment the
 * dialog was opened — used to find its position on save (even if the user renames it in the form)
 * and to exclude it from the duplicate-name check against itself.
 */
const originalName = ref<string | null>(null)

const name = ref('')
/** `null` means "not filled in yet"; unlike a limitation's `selfLimit` this is not an allowed value. */
const distance = ref<number | null>(null)

watch(
  () => [open.value, props.minDistance] as const,
  ([isOpen, minDistance]) => {
    if (!isOpen)
      return

    originalName.value = minDistance?.name ?? null
    name.value = minDistance?.name ?? ''
    distance.value = minDistance?.distance ?? null
  },
  { immediate: true },
)

async function handleSubmit() {
  const trimmedName = name.value.trim()

  const siblings = (props.categorySet.minDistances ?? [])
    .filter(d => d.name !== originalName.value)
  if (siblings.some(d => d.name === trimmedName)) {
    toast.error(`A minimum distance for "${trimmedName}" already exists in this set`)
    return
  }

  // Caught before the schema sees it: an empty number field would reach zod as `NaN` and come back
  // as "expected number, received NaN", which says nothing to the person who just left it blank.
  if (distance.value === null) {
    toast.error('Enter how many rounds must separate two tracks')
    return
  }

  const validation = fieldMinDistanceSchema.safeParse({ name: trimmedName, distance: distance.value })
  if (!validation.success) {
    toast.error(validation.error.issues[0]?.message ?? 'Invalid minimum distance')
    return
  }

  const current = props.categorySet.minDistances ?? []
  const existingIndex = current.findIndex(d => d.name === originalName.value)
  const next = existingIndex >= 0
    ? current.map((d, i) => (i === existingIndex ? validation.data : d))
    : [...current, validation.data]

  try {
    await categorySetsStore.setMinDistances(props.categorySet.id, next)
    open.value = false
  }
  catch (err) {
    toast.error(`Failed to save minimum distance: ${(err as Error).message}`)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ isEditMode ? 'Edit minimum distance' : 'Add minimum distance' }}</DialogTitle>
        <DialogDescription>
          Keeps two tracks sharing a value in this field at least this many rounds apart.
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4 py-2" @submit.prevent="handleSubmit">
        <div class="grid gap-2">
          <Label for="min-distance-name">Field</Label>
          <SuggestInput
            id="min-distance-name"
            v-model="name"
            :suggestions="fieldSuggestions"
            placeholder="e.g. work"
          />
        </div>

        <div class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3">
          <Label for="min-distance-rounds">Rounds apart</Label>
          <NumberField
            id="min-distance-rounds"
            :model-value="distance ?? undefined"
            :min="2"
            class="w-40"
            @update:model-value="(v) => (distance = typeof v === 'number' && !Number.isNaN(v) ? v : null)"
          >
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput placeholder="Rounds" />
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
          {{ isEditMode ? 'Save' : 'Add' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
