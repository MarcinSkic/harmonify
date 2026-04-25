<script setup lang="ts">
import type { Playlist } from '@/db/schemas'
import { Check } from '@lucide/vue'
import { computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LibraryService } from '@/services'
import { useCategorySetsStore } from '@/stores'

const props = defineProps<{
  playlist: Playlist
}>()

const open = defineModel<boolean>('open', { required: true })

const categorySetsStore = useCategorySetsStore()

const currentSetId = computed(() => props.playlist.categorySetId ?? null)

async function select(setId: string | null) {
  await LibraryService.updatePlaylist(props.playlist.id, { categorySetId: setId ?? undefined })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Link category set to "{{ playlist.name }}"</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-1">
        <button
          type="button"
          class="
            flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm
            hover:bg-muted/50
          "
          @click="select(null)"
        >
          <Check
            class="size-4 shrink-0"
            :class="currentSetId === null ? 'opacity-100' : 'opacity-0'"
          />
          <span class="text-muted-foreground">None</span>
        </button>

        <button
          v-for="set in categorySetsStore.categorySets"
          :key="set.id"
          type="button"
          class="
            flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm
            hover:bg-muted/50
          "
          @click="select(set.id)"
        >
          <Check
            class="size-4 shrink-0"
            :class="currentSetId === set.id ? 'opacity-100' : 'opacity-0'"
          />
          <span>{{ set.name }}</span>
        </button>

        <div
          v-if="categorySetsStore.categorySets.length === 0"
          class="py-3 text-center text-sm text-muted-foreground"
        >
          No sets yet. Create one first.
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
