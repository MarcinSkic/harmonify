<script setup lang="ts">
import type { ConditionRow, Operator } from './categoryMatchRows'
import type { CategoryMatch, OverlayField } from '@/db/schemas'
import { Plus, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import SuggestInput from '@/components/SuggestInput.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useNavidromeTagIndex } from '@/composables/useNavidromeTagIndex'
import { LibraryOverlayService } from '@/services'
import { useOverlayFieldsStore } from '@/stores'
import {
  ALL_OPERATORS,
  conditionsFromRows,
  emptyRow,
  NUMBER_OPERATORS,
  OPERATOR_LABELS,
  PRESENCE_OPERATORS,
  rowError,
  rowsFromMatch,
  TEXT_OPERATORS,
} from './categoryMatchRows'

/**
 * `null` while the rows do not form a valid predicate — the dialog refuses to save then.
 *
 * The model is written, never read back: the rows are seeded from it once, here at setup. A parent
 * that needs to load a different predicate remounts the editor with a `:key` instead. Syncing the
 * incoming model into the rows cannot work — `ref()` deep-wraps on assignment, so the value that
 * comes back as a prop is a reactive proxy of the emitted object and never identical to it, which
 * left the two watchers rebuilding each other's sources until Vue aborted the flush.
 */
const model = defineModel<CategoryMatch | null>({ required: true })

const overlayFieldsStore = useOverlayFieldsStore()
const { tagNames, valuesFor, load: loadTagIndex } = useNavidromeTagIndex()

const mode = ref<'all' | 'any'>(model.value && 'any' in model.value ? 'any' : 'all')
const rows = ref<ConditionRow[]>(rowsFromMatch(model.value))
const overlayValueFieldNames = ref<string[]>([])

loadTagIndex()
loadOverlayValueFieldNames()

/**
 * Field names that only the values know about: a column imported from a CSV writes
 * `customFields.popularity` on every overlay while the registry stays empty, and the predicate can
 * read it all the same. Read once on mount, like the tag index — the registry is small, but this
 * scans a row per track.
 */
async function loadOverlayValueFieldNames() {
  try {
    overlayValueFieldNames.value = await LibraryOverlayService.listCustomFieldNames()
  }
  catch (error) {
    // Background load behind a suggestion list: without it the editor still takes free text.
    console.error('Failed to read overlay field names', error)
  }
}

const fieldSuggestions = computed(() => {
  const names = new Set([
    ...tagNames.value,
    ...overlayFieldsStore.overlayFields.map(field => field.name),
    ...overlayValueFieldNames.value,
  ])
  return [...names].sort((a, b) => a.localeCompare(b))
})

const overlayFieldTypes = computed(
  () => new Map(overlayFieldsStore.overlayFields.map(field => [field.name, field.type] as const)),
)

/** A field the registry types narrows the operator list; a Navidrome tag or an unknown name keeps
 * all of them — the evaluator coerces by operator, not by declared type. */
function operatorsFor(field: string): Operator[] {
  const type: OverlayField['type'] | undefined = overlayFieldTypes.value.get(field.trim())
  if (type === 'number')
    return [...NUMBER_OPERATORS, ...PRESENCE_OPERATORS]
  if (type === 'text')
    return [...TEXT_OPERATORS, ...PRESENCE_OPERATORS]
  return ALL_OPERATORS
}

function valueSuggestions(row: ConditionRow): string[] {
  if (row.operator !== 'is' && row.operator !== 'isNot')
    return []
  return [...valuesFor(row.field.trim())].sort((a, b) => a.localeCompare(b))
}

function addRow() {
  rows.value = [...rows.value, emptyRow()]
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
  if (rows.value.length === 0)
    rows.value = [emptyRow()]
}

/**
 * Reconciles the operator with the field's declared type once the name is settled — on blur, not on
 * every keystroke: every prefix of a registered name is an unknown field, so reacting while typing
 * would swap the operator the user picked back and forth.
 */
function handleFieldChange(row: ConditionRow) {
  const allowed = operatorsFor(row.field)
  if (!allowed.includes(row.operator))
    row.operator = allowed[0]
}

watch([rows, mode], () => {
  const conditions = conditionsFromRows(rows.value)
  model.value = conditions === null
    ? null
    : (mode.value === 'all' ? { all: conditions } : { any: conditions })
}, { deep: true })
</script>

<template>
  <div class="grid gap-2">
    <ToggleGroup
      type="single"
      class="w-full"
      :model-value="mode"
      @update:model-value="(v) => v && (mode = v as 'all' | 'any')"
    >
      <ToggleGroupItem
        value="all"
        class="
          flex-1
          data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
        "
      >
        Match all
      </ToggleGroupItem>
      <ToggleGroupItem
        value="any"
        class="
          flex-1
          data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
        "
      >
        Match any
      </ToggleGroupItem>
    </ToggleGroup>

    <div v-for="(row, index) in rows" :key="index" class="grid gap-1">
      <div class="flex items-start gap-2">
        <SuggestInput
          v-model="row.field"
          :suggestions="fieldSuggestions"
          placeholder="Field"
          class="min-w-0 flex-1"
          @blur="handleFieldChange(row)"
        />

        <Select
          :model-value="row.operator"
          @update:model-value="(v) => v && (row.operator = v as Operator)"
        >
          <SelectTrigger class="w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="operator in operatorsFor(row.field)"
                :key="operator"
                :value="operator"
              >
                {{ OPERATOR_LABELS[operator] }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <SuggestInput
          v-if="row.operator === 'is' || row.operator === 'isNot'"
          v-model="row.value"
          :suggestions="valueSuggestions(row)"
          placeholder="Value"
          class="min-w-0 flex-1"
        />
        <Input
          v-else-if="row.operator === 'contains'"
          v-model="row.value"
          placeholder="Value"
          class="min-w-0 flex-1"
          autocomplete="off"
        />
        <template v-else-if="row.operator === 'inTheRange'">
          <Input
            v-model="row.value"
            type="number"
            placeholder="From"
            class="min-w-0 flex-1"
            autocomplete="off"
          />
          <Input
            v-model="row.rangeEnd"
            type="number"
            placeholder="To"
            class="min-w-0 flex-1"
            autocomplete="off"
          />
        </template>
        <Input
          v-else-if="row.operator === 'gt' || row.operator === 'lt'"
          v-model="row.value"
          type="number"
          placeholder="Number"
          class="min-w-0 flex-1"
          autocomplete="off"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-9 shrink-0"
          @click="removeRow(index)"
        >
          <X class="size-4" />
        </Button>
      </div>

      <p v-if="rowError(row)" class="text-xs text-destructive">
        {{ rowError(row) }}
      </p>
    </div>

    <Button type="button" variant="outline" size="sm" class="w-fit gap-1.5" @click="addRow">
      <Plus class="size-4" />
      Add condition
    </Button>
  </div>
</template>
