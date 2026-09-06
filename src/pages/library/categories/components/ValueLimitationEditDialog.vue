<script setup lang="ts">
import type { CategorySet, FieldLimitation, MultiValueMode, OtherValueException } from '@/db/schemas'
import { Plus, X } from '@lucide/vue'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useNavidromeTagIndex } from '@/composables/useNavidromeTagIndex'
import { fieldLimitationSchema } from '@/db/schemas'
import { findDuplicatePairLimitationName } from '@/lib/categoryJson'
import { useCategorySetsStore, useOverlayFieldsStore } from '@/stores'

const props = defineProps<{
  categorySet: CategorySet
  limitation: FieldLimitation | null
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

const isEditMode = computed(() => props.limitation !== null)

/**
 * `null` while adding a new entry. While editing, this is the entry's `name` at the moment the
 * dialog was opened — used to find its position on save (even if the user renames it in the form)
 * and to exclude it from the duplicate-name check against itself.
 */
const originalName = ref<string | null>(null)

interface PairRow {
  name: string
  limit: number | null
  multiValue: MultiValueMode
  /** Carried through untouched — this dialog has no UI for editing a pair's own exceptions. */
  exceptions?: OtherValueException[]
}

const name = ref('')
const selfLimit = ref<number | null>(null)
const multiValue = ref<MultiValueMode>('all')
const pairs = ref<PairRow[]>([])
/** Carried through untouched — the dialog copies input to local state, it never edits it live. */
const exceptions = ref<FieldLimitation['exceptions']>(undefined)

watch(
  () => [open.value, props.limitation] as const,
  ([isOpen, limitation]) => {
    if (!isOpen)
      return

    originalName.value = limitation?.name ?? null

    if (limitation) {
      name.value = limitation.name
      selfLimit.value = limitation.selfLimit ?? null
      multiValue.value = limitation.multiValue ?? 'all'
      pairs.value = (limitation.otherValuesLimit ?? []).map(pair => ({
        name: pair.name,
        limit: pair.limit,
        multiValue: pair.multiValue ?? 'all',
        exceptions: pair.exceptions,
      }))
      exceptions.value = limitation.exceptions
    }
    else {
      name.value = ''
      selfLimit.value = null
      multiValue.value = 'all'
      pairs.value = []
      exceptions.value = undefined
    }
  },
  { immediate: true },
)

function addPairRow() {
  pairs.value = [...pairs.value, { name: '', limit: null, multiValue: 'all' }]
}

function removePairRow(index: number) {
  pairs.value = pairs.value.filter((_, i) => i !== index)
}

async function handleSubmit() {
  const trimmedName = name.value.trim()

  const siblings = (props.categorySet.valueLimitations ?? [])
    .filter(l => l.name !== originalName.value)
  if (siblings.some(l => l.name === trimmedName)) {
    toast.error(`A value limitation named "${trimmedName}" already exists in this set`)
    return
  }

  // A freshly added, still-blank row is a no-op, not a mistake — drop it instead of handing the
  // schema a `{ name: '', limit: NaN }` that reports an error the user has no way to connect to it.
  const filledPairs = pairs.value.filter(pair => pair.name.trim() !== '' || pair.limit !== null)

  // Two pair limits naming the same field would resolve to the same (X, Y) counter and double-charge
  // it — the engine assumes this can't happen (see the comment in `valuesLimitations.ts`).
  const duplicatePairName = findDuplicatePairLimitationName(
    filledPairs.map(pair => ({ name: pair.name.trim() })),
  )
  if (duplicatePairName) {
    toast.error(`A pair limit named "${duplicatePairName}" is already used in this entry`)
    return
  }

  const payload = {
    name: trimmedName,
    selfLimit: selfLimit.value ?? undefined,
    multiValue: multiValue.value !== 'all' ? multiValue.value : undefined,
    otherValuesLimit: filledPairs.length > 0
      ? filledPairs.map(pair => ({
          name: pair.name.trim(),
          limit: pair.limit ?? Number.NaN,
          multiValue: pair.multiValue !== 'all' ? pair.multiValue : undefined,
          exceptions: pair.exceptions,
        }))
      : undefined,
    exceptions: exceptions.value,
  }

  const validation = fieldLimitationSchema.safeParse(payload)
  if (!validation.success) {
    toast.error(validation.error.issues[0]?.message ?? 'Invalid value limitation')
    return
  }

  const current = props.categorySet.valueLimitations ?? []
  const existingIndex = current.findIndex(l => l.name === originalName.value)
  const next = existingIndex >= 0
    ? current.map((l, i) => (i === existingIndex ? validation.data : l))
    : [...current, validation.data]

  try {
    await categorySetsStore.setValueLimitations(props.categorySet.id, next)
    open.value = false
  }
  catch (err) {
    toast.error(`Failed to save value limitation: ${(err as Error).message}`)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ isEditMode ? 'Edit value limit' : 'Add value limit' }}</DialogTitle>
        <DialogDescription>
          Caps how many times the same field value repeats in the pool.
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4 py-2" @submit.prevent="handleSubmit">
        <div class="grid gap-2">
          <Label for="limitation-name">Field</Label>
          <SuggestInput
            id="limitation-name"
            v-model="name"
            :suggestions="fieldSuggestions"
            placeholder="e.g. work"
          />
        </div>

        <div class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3">
          <Label for="limitation-self-limit">Self max</Label>
          <NumberField
            id="limitation-self-limit"
            :model-value="selfLimit ?? undefined"
            :min="0"
            class="w-40"
            @update:model-value="(v) => (selfLimit = typeof v === 'number' && !Number.isNaN(v) ? v : null)"
          >
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput placeholder="No limit" />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </div>

        <div class="grid gap-2">
          <Label>Multi-value</Label>
          <ToggleGroup
            type="single"
            class="w-full"
            :model-value="multiValue"
            @update:model-value="(v) => v && (multiValue = v as MultiValueMode)"
          >
            <ToggleGroupItem
              value="all"
              class="
                flex-1
                data-[state=on]:bg-primary
                data-[state=on]:text-primary-foreground
              "
            >
              all
            </ToggleGroupItem>
            <ToggleGroupItem
              value="first"
              class="
                flex-1
                data-[state=on]:bg-primary
                data-[state=on]:text-primary-foreground
              "
            >
              first
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div class="grid gap-2">
          <Label>Pair limits</Label>
          <div v-for="(pair, index) in pairs" :key="index" class="
            flex items-center gap-2
          "
          >
            <SuggestInput
              v-model="pair.name"
              :suggestions="fieldSuggestions"
              placeholder="Field"
              class="min-w-0 flex-1"
            />
            <NumberField
              :model-value="pair.limit ?? undefined"
              :min="0"
              class="w-28 shrink-0"
              @update:model-value="(v) => (pair.limit = typeof v === 'number' && !Number.isNaN(v) ? v : null)"
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput placeholder="Limit" />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <ToggleGroup
              type="single"
              class="shrink-0"
              :model-value="pair.multiValue"
              @update:model-value="(v) => v && (pair.multiValue = v as MultiValueMode)"
            >
              <ToggleGroupItem value="all">
                all
              </ToggleGroupItem>
              <ToggleGroupItem value="first">
                first
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-9 shrink-0"
              @click="removePairRow(index)"
            >
              <X class="size-4" />
            </Button>
          </div>

          <Button type="button" variant="outline" size="sm" class="
            w-fit gap-1.5
          " @click="addPairRow"
          >
            <Plus class="size-4" />
            Add pair limit
          </Button>
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
