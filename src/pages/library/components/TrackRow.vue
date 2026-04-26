<script setup lang="ts">
import type { Track } from '@/db/schemas'
import { Music, Trash2 } from '@lucide/vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Switch } from '@/components/ui/switch'
import {
  TableCell,
  TableRow,
} from '@/components/ui/table'
import { useLinkPreview } from '@/composables/useLinkPreview'
import { useLibraryStore } from '@/stores'

const props = defineProps<{
  track: Track
}>()

const libraryStore = useLibraryStore()
const { blobUrl: previewImageUrl } = useLinkPreview(computed(() => props.track.previewImageUrl))

const hasAnyImage = computed(() => !!(props.track.albumImageUrl || previewImageUrl.value))
</script>

<template>
  <TableRow :class="{ 'opacity-50': libraryStore.selectedPlaylistId !== null && track.enabledByPlaylist[libraryStore.selectedPlaylistId] === false }">
    <TableCell>
      <div class="flex items-center gap-3">
        <HoverCard v-if="hasAnyImage" :open-delay="300" :close-delay="100">
          <HoverCardTrigger as-child>
            <div class="relative size-10">
              <img
                v-if="previewImageUrl && track.albumImageUrl"
                :src="previewImageUrl"
                :alt="track.name"
                class="
                  absolute inset-0 size-10 translate-x-[15%] translate-y-[15%]
                  rounded-sm object-cover object-bottom-right
                "
              >
              <img
                v-if="track.albumImageUrl"
                :src="track.albumImageUrl"
                :alt="track.albumName"
                class="absolute inset-0 z-10 size-10 rounded-sm object-cover"
              >
              <img
                v-else-if="previewImageUrl"
                :src="previewImageUrl"
                :alt="track.name"
                class="absolute inset-0 size-10 rounded-sm object-cover"
              >
            </div>
          </HoverCardTrigger>
          <HoverCardContent class="w-auto overflow-hidden p-0" side="right" align="start">
            <div class="flex">
              <img
                v-if="track.albumImageUrl"
                :src="track.albumImageUrl"
                :alt="track.albumName"
                class="size-56 object-cover"
              >
              <img
                v-if="previewImageUrl"
                :src="previewImageUrl"
                :alt="track.name"
                class="h-56 w-auto object-cover"
              >
            </div>
          </HoverCardContent>
        </HoverCard>
        <div
          v-else
          class="flex size-10 items-center justify-center rounded-sm bg-muted"
        >
          <Music class="size-5 text-muted-foreground" />
        </div>
        <div class="min-w-0">
          <p class="truncate font-medium">
            {{ track.name }}
          </p>
          <p class="truncate text-sm text-muted-foreground">
            {{ track.artists.join(', ') }}
          </p>
        </div>
      </div>
    </TableCell>
    <TableCell
      class="
        hidden
        md:table-cell
      "
    >
      {{ track.albumName }}
    </TableCell>
    <TableCell
      class="
        hidden
        lg:table-cell
      "
    >
      <div class="flex flex-wrap gap-1">
        <Badge
          v-for="tag in track.tags" :key="tag" variant="secondary" class="
            text-xs
          "
        >
          {{ tag }}
        </Badge>
      </div>
    </TableCell>
    <TableCell>
      <div class="flex items-center gap-1">
        <Switch
          v-if="libraryStore.selectedPlaylistId !== null"
          :model-value="track.enabledByPlaylist[libraryStore.selectedPlaylistId] !== false"
          @update:model-value="libraryStore.setTrackEnabled(track.id, libraryStore.selectedPlaylistId!, $event)"
        />
        <Button
          variant="ghost"
          size="icon"
          class="size-8"
          @click="libraryStore.removeTrack(track.id)"
        >
          <Trash2
            class="
              size-4 text-muted-foreground
              hover:text-destructive
            "
          />
        </Button>
      </div>
    </TableCell>
  </TableRow>
</template>
