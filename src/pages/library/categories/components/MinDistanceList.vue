<script setup lang="ts">
import type { FieldMinDistance } from '@/db/schemas'
import { Pencil, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useCategorySetsStore } from '@/stores'

const props = defineProps<{
  setId: string
  distances: FieldMinDistance[]
}>()

const emit = defineEmits<{
  edit: [distance: FieldMinDistance]
}>()

const categorySetsStore = useCategorySetsStore()

async function remove(name: string) {
  const next = props.distances.filter(d => d.name !== name)
  await categorySetsStore.setMinDistances(props.setId, next)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-if="distances.length === 0"
      class="py-3 text-center text-sm text-muted-foreground"
    >
      No minimum distances in this set.
    </div>
    <div
      v-for="distance in distances"
      :key="distance.name"
      class="
        flex items-center gap-2 rounded-md px-2 py-1.5
        hover:bg-muted/50
      "
    >
      <div class="min-w-0 flex-1 text-sm">
        <span class="font-medium">{{ distance.name }}</span>
        <span class="text-muted-foreground">
          — min {{ distance.distance }} {{ distance.distance === 1 ? 'round' : 'rounds' }}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-7 shrink-0"
        @click="emit('edit', distance)"
      >
        <Pencil class="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-7 shrink-0"
        @click="remove(distance.name)"
      >
        <X class="size-3" />
      </Button>
    </div>
  </div>
</template>
