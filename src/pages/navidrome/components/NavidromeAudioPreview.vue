<script setup lang="ts">
import type { SubsonicSong } from '@/services/navidrome'
import { X } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { NavidromeService } from '@/services'

const props = defineProps<{
  song: SubsonicSong
}>()

defineEmits<{
  close: []
}>()

// Subsonic carries the credentials in the query string, so the plain element streams it directly.
const streamUrl = computed(() => NavidromeService.getStreamUrl(props.song.id))
</script>

<template>
  <div class="flex items-center gap-3 border-t bg-card p-3">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">
        {{ song.title }}
      </p>
      <p class="truncate text-xs text-muted-foreground">
        {{ song.artist ?? 'Unknown artist' }}
      </p>
    </div>
    <audio :key="streamUrl" :src="streamUrl" controls autoplay class="h-9" />
    <Button variant="ghost" size="icon" title="Close player" @click="$emit('close')">
      <X class="size-4" />
    </Button>
  </div>
</template>
