<script setup lang="ts">
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
  </div>
</template>
