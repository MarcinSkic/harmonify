<script setup lang="ts">
import type { FieldLimitation } from '@/db/schemas'
import { computed } from 'vue'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCategorySetsStore } from '@/stores'

const categorySetId = defineModel<string | null>({ required: true })

const categorySetsStore = useCategorySetsStore()

const sets = computed(() => categorySetsStore.categorySets.map(set => ({
  id: set.id,
  name: set.name,
  size: categorySetsStore.getMembersForSet(set.id).length,
})))

/** "work ≤3, grouping ≤1" — every `selfLimit` and every `otherValuesLimit` pair, flattened in order. */
function describeLimitations(limitations: FieldLimitation[]): string {
  const parts: string[] = []
  for (const limitation of limitations) {
    if (limitation.selfLimit !== undefined)
      parts.push(`${limitation.name} ≤${limitation.selfLimit}`)
    for (const pair of limitation.otherValuesLimit ?? [])
      parts.push(`${pair.name} ≤${pair.limit}`)
  }
  return parts.join(', ')
}

// So the host sees what trims the pool without leaving setup to check the library.
const limitationsCaption = computed(() => {
  const set = categorySetsStore.categorySets.find(s => s.id === categorySetId.value)
  const description = describeLimitations(set?.valueLimitations ?? [])
  return description === '' ? null : `Trims the pool: ${description}`
})
</script>

<template>
  <div class="flex w-full flex-col gap-1">
    <Select
      :model-value="categorySetId ?? ''"
      :disabled="sets.length === 0"
      @update:model-value="(value) => categorySetId = (value as string) || null"
    >
      <SelectTrigger class="w-full">
        <SelectValue placeholder="Select a category set" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem v-for="set in sets" :key="set.id" :value="set.id">
            {{ set.name }} ({{ set.size }})
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
    <p v-if="sets.length === 0" class="text-sm text-muted-foreground">
      No category sets yet — create one in Library → Category Sets.
    </p>
    <p v-else-if="limitationsCaption" class="text-xs text-muted-foreground">
      {{ limitationsCaption }}
    </p>
  </div>
</template>
