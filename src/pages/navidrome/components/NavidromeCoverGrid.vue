<script setup lang="ts">
import type { NavidromeCoverTile } from '../types'
import { ChevronLeft, ChevronRight, ImageOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NavidromeService } from '@/services'

defineProps<{
  tiles: NavidromeCoverTile[]
  isLoading: boolean
  emptyMessage: string
  page: number
  hasNextPage: boolean
}>()

defineEmits<{
  select: [id: string]
  previous: []
  next: []
}>()

function coverUrl(coverArt: string): string {
  return NavidromeService.getCoverArtUrl(coverArt, 300)
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
      <template v-if="isLoading">
        <div v-for="i in 12" :key="i" class="space-y-2">
          <Skeleton class="aspect-square w-full" />
          <Skeleton class="mx-1 h-4" />
        </div>
      </template>

      <p
        v-else-if="tiles.length === 0"
        class="col-span-full py-8 text-center text-sm text-muted-foreground"
      >
        {{ emptyMessage }}
      </p>

      <template v-else>
        <button
          v-for="tile in tiles"
          :key="tile.id"
          type="button"
          class="
            flex flex-col gap-2 rounded-lg border bg-card p-2 text-left
            transition-colors
            hover:bg-accent hover:text-accent-foreground
          "
          @click="$emit('select', tile.id)"
        >
          <div
            class="
              flex aspect-square items-center justify-center overflow-hidden
              rounded-md bg-muted
            "
          >
            <img
              v-if="tile.coverArt"
              :src="coverUrl(tile.coverArt)"
              :alt="tile.title"
              class="size-full object-cover"
              loading="lazy"
            >
            <ImageOff v-else class="size-8 text-muted-foreground" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">
              {{ tile.title }}
            </p>
            <p class="truncate text-xs text-muted-foreground">
              {{ tile.subtitle }}
            </p>
          </div>
        </button>
      </template>
    </div>

    <!-- No total is available (`getAlbumList2` does not report one), so this is prev/next only. -->
    <div v-if="page > 0 || hasNextPage" class="
      flex items-center justify-center gap-3
    "
    >
      <Button
        variant="outline"
        size="icon"
        title="Previous page"
        :disabled="page === 0 || isLoading"
        @click="$emit('previous')"
      >
        <ChevronLeft class="size-4" />
      </Button>
      <span class="text-sm text-muted-foreground">Page {{ page + 1 }}</span>
      <Button
        variant="outline"
        size="icon"
        title="Next page"
        :disabled="!hasNextPage || isLoading"
        @click="$emit('next')"
      >
        <ChevronRight class="size-4" />
      </Button>
    </div>
  </div>
</template>
