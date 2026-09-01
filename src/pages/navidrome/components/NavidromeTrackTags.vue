<script setup lang="ts">
import type { SubsonicSong } from '@/services/navidrome'
import { computed, ref, watch } from 'vue'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { reportNavidromeError } from '@/lib/navidrome'
import { NavidromeService } from '@/services'
import { useNavidromeStore } from '@/stores'

const props = defineProps<{
  song: SubsonicSong | null
}>()

const open = defineModel<boolean>('open', { required: true })

const navidromeStore = useNavidromeStore()

const tags = ref<Record<string, string[]>>({})
const isLoading = ref(false)
const loadError = ref(false)

// Guards against a stale response overwriting the tags of a song opened later.
let requestId = 0

const tagEntries = computed(() => Object.entries(tags.value))

watch([open, () => props.song?.id], async ([isOpen, songId]) => {
  if (!isOpen || !songId)
    return

  const request = ++requestId
  isLoading.value = true
  loadError.value = false
  tags.value = {}

  try {
    // The unstable native API is called here and only here — once, on demand.
    const loaded = await NavidromeService.getSongTags(songId)

    if (request === requestId)
      tags.value = loaded
  }
  catch (error) {
    // A superseded request must not toast over the song the user is looking at now.
    if (request === requestId) {
      loadError.value = true
      reportNavidromeError(error, 'Could not load the track tags')
      navidromeStore.reportSessionError(error)
    }
  }
  finally {
    if (request === requestId)
      isLoading.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ song?.title ?? 'Track tags' }}</DialogTitle>
        <DialogDescription>
          {{ song?.artist ?? 'Unknown artist' }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="isLoading" class="space-y-2">
        <Skeleton class="h-5 w-1/3" />
        <Skeleton class="h-5 w-2/3" />
      </div>

      <p v-else-if="loadError" class="text-sm text-muted-foreground">
        Could not load the tags of this track.
      </p>

      <div v-else class="flex flex-col gap-3">
        <p v-if="tagEntries.length === 0" class="text-sm text-muted-foreground">
          This track has no custom tags. Configure <code>Tags.*</code> in Navidrome
          and run a full library scan.
        </p>

        <div v-for="[name, values] of tagEntries" :key="name" class="
          flex flex-col gap-1
        "
        >
          <span class="text-xs font-medium text-muted-foreground">{{ name }}</span>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="value of values" :key="value" variant="secondary">
              {{ value }}
            </Badge>
          </div>
        </div>

        <div v-if="song?.musicBrainzId" class="
          flex flex-col gap-1 border-t pt-3
        "
        >
          <span class="text-xs font-medium text-muted-foreground">MusicBrainz ID</span>
          <code class="text-xs break-all">{{ song.musicBrainzId }}</code>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
