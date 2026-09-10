<script setup lang="ts">
import type { OverlayKeySource } from '@/lib/trackOverlayKey'
import type { SubsonicSong } from '@/services/navidrome'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useLinkPreview } from '@/composables/useLinkPreview'
import { formatPlaybackRange, parsePlaybackRange } from '@/lib/csv'
import { deriveOverlayKey } from '@/lib/trackOverlayKey'
import { LibraryOverlayService, LinkPreviewService } from '@/services'
import { useOverlayFieldsStore } from '@/stores'

const props = defineProps<{
  song: SubsonicSong | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })

const overlayFieldsStore = useOverlayFieldsStore()
const registeredFieldNames = computed(() => overlayFieldsStore.overlayFields.map(field => field.name))

const playbackStart = ref('')
const playbackEnd = ref('')
const previewImageUrl = ref('')
const enabled = ref(true)
const customFields = ref<Array<{ name: string, value: string }>>([])
const originalCustomFieldNames = ref<string[]>([])

function overlaySource(song: SubsonicSong): OverlayKeySource & { artist?: string } {
  return {
    musicBrainzId: song.musicBrainzId,
    albumId: song.albumId,
    discNumber: song.discNumber,
    track: song.track,
    title: song.title,
    artist: song.artist,
  }
}

watch([open, () => props.song?.id], async ([isOpen, songId]) => {
  if (!isOpen || !songId || !props.song)
    return

  const key = deriveOverlayKey(overlaySource(props.song))
  const overlay = await LibraryOverlayService.getOverlay(key)

  if (overlay?.playbackRange) {
    const [start, end] = formatPlaybackRange(overlay.playbackRange).split('-')
    playbackStart.value = start
    playbackEnd.value = end
  }
  else {
    playbackStart.value = ''
    playbackEnd.value = ''
  }

  previewImageUrl.value = overlay?.previewImageUrl ?? ''
  enabled.value = overlay?.enabled ?? true

  const fields = overlay?.customFields ?? {}
  customFields.value = Object.entries(fields).map(([name, value]) => ({ name, value }))
  originalCustomFieldNames.value = Object.keys(fields)
})

const previewImageIsSet = computed(() => previewImageUrl.value.trim() !== '')

const { blobUrl: previewBlobUrl, status: previewStatus } = useLinkPreview(
  computed(() => previewImageUrl.value.trim() || undefined),
)

const previewFailed = computed(() => previewStatus.value === 'error')

const previewStatusMessage = computed(() => {
  switch (previewStatus.value) {
    case 'pending':
      return 'Fetching preview…'
    case 'fetched':
      return 'Preview ready'
    case 'error':
      return 'Preview could not be fetched — the round would fall back to the album cover.'
    // No record yet: `upsertOverlay` is what queues the URL, so a freshly typed one has none.
    default:
      return 'Preview will be fetched when you save.'
  }
})

async function handleRetryPreview() {
  const url = previewImageUrl.value.trim()
  if (!url)
    return

  try {
    await LinkPreviewService.retryPreview(url)
  }
  catch (err) {
    toast.error(`Failed to retry the preview: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function addCustomField() {
  customFields.value.push({ name: '', value: '' })
}

function removeCustomField(index: number) {
  customFields.value.splice(index, 1)
}

async function handleSubmit() {
  if (!props.song)
    return

  const durationMs = props.song.duration != null ? props.song.duration * 1000 : undefined
  const hasStart = playbackStart.value.trim() !== ''
  const hasEnd = playbackEnd.value.trim() !== ''

  let playbackRange = null as { startMs: number, endMs: number } | null

  if (hasStart || hasEnd) {
    if (!hasStart || !hasEnd) {
      toast.error('Provide both the start and the end of the playback range')
      return
    }

    const parsed = parsePlaybackRange(`${playbackStart.value.trim()}-${playbackEnd.value.trim()}`)
    if (!parsed) {
      toast.error('Invalid playback range, expected mm:ss for both start and end')
      return
    }
    if (parsed.startMs >= parsed.endMs) {
      toast.error('The range start must be before its end')
      return
    }
    if (durationMs != null && (parsed.startMs > durationMs || parsed.endMs > durationMs)) {
      toast.error('The range exceeds the track\'s duration')
      return
    }

    playbackRange = parsed
  }

  const source = overlaySource(props.song)

  try {
    await LibraryOverlayService.upsertOverlay(source, {
      playbackRange,
      previewImageUrl: previewImageUrl.value.trim() || undefined,
      enabled: enabled.value,
    })

    const currentNames = new Set(
      customFields.value.map(f => f.name.trim()).filter(name => name !== ''),
    )
    const removedNames = originalCustomFieldNames.value.filter(name => !currentNames.has(name))
    const key = deriveOverlayKey(source)

    await Promise.all([
      ...customFields.value
        .filter(f => f.name.trim() !== '')
        .map(f => LibraryOverlayService.setCustomField(source, f.name.trim(), f.value)),
      ...removedNames.map(name => LibraryOverlayService.removeCustomField(key, name)),
    ])

    emit('saved')
    open.value = false
  }
  catch (err) {
    toast.error(`Failed to save overlay: ${err instanceof Error ? err.message : String(err)}`)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ song?.title ?? 'Track overlay' }}</DialogTitle>
        <DialogDescription>
          {{ song?.artist ?? 'Unknown artist' }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4 py-2" @submit.prevent="handleSubmit">
        <div class="grid gap-2">
          <Label>Playback range</Label>
          <div class="flex items-center gap-2">
            <Input v-model="playbackStart" placeholder="mm:ss" class="w-24" autocomplete="off" />
            <span class="text-muted-foreground">–</span>
            <Input v-model="playbackEnd" placeholder="mm:ss" class="w-24" autocomplete="off" />
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="overlay-preview-image">Preview image URL</Label>
          <Input
            id="overlay-preview-image"
            v-model="previewImageUrl"
            placeholder="https://..."
            autocomplete="off"
          />
          <div v-if="previewImageIsSet" class="flex items-center gap-2">
            <p
              class="text-xs"
              :class="[previewFailed ? 'text-destructive' : `
                text-muted-foreground
              `]"
            >
              {{ previewStatusMessage }}
            </p>
            <Button
              v-if="previewFailed"
              type="button"
              variant="outline"
              size="sm"
              class="h-6 px-2 text-xs"
              @click="handleRetryPreview"
            >
              Retry
            </Button>
          </div>
          <!-- Once the proxy has the blob, show it: the raw URL only proves the browser can load
               it cross-origin, which the round cannot do. -->
          <img
            v-if="previewImageIsSet"
            :src="previewBlobUrl ?? previewImageUrl"
            alt="Preview"
            class="size-24 rounded-md border object-cover"
          >
        </div>

        <div class="flex items-center justify-between">
          <Label>Enabled</Label>
          <Switch v-model:model-value="enabled" />
        </div>

        <div class="grid gap-2 border-t pt-3">
          <Label>Additional fields</Label>
          <div
            v-for="(field, index) in customFields"
            :key="index"
            class="flex items-center gap-2"
          >
            <SuggestInput
              v-model="field.name"
              :suggestions="registeredFieldNames"
              placeholder="Field name"
              class="flex-1"
            />
            <Input v-model="field.value" placeholder="Value" class="flex-1" autocomplete="off" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-8 shrink-0"
              @click="removeCustomField(index)"
            >
              <X class="size-4" />
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" class="
            w-fit gap-1.5
          " @click="addCustomField"
          >
            <Plus class="size-4" /> Add field
          </Button>
        </div>
      </form>

      <DialogFooter>
        <Button type="button" variant="ghost" @click="open = false">
          Cancel
        </Button>
        <Button type="button" @click="handleSubmit">
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
