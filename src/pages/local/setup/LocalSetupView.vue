<script setup lang="ts">
import type { Category, LocalGameSettings, Track } from '@/db/schemas'
import { useWindowSize } from '@vueuse/core'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { Breakpoint } from '@/consts'
import { db } from '@/db'
import LibraryTrackPicker from '@/pages/game/setup/components/LibraryTrackPicker.vue'
import { useMusicPlayerStore } from '@/pages/game/stores'
import { useLocalGameStore } from '@/pages/local/stores'
import { LibraryService } from '@/services'
import { useSettingsStore } from '@/stores'
import LocalGameSettingsForm from './components/LocalGameSettingsForm.vue'
import TeamManager from './components/TeamManager.vue'

const router = useRouter()
const localGameStore = useLocalGameStore()
const musicPlayerStore = useMusicPlayerStore()
const settingsStore = useSettingsStore()
const { width: screenWidth } = useWindowSize()

const isDesktop = computed(() => screenWidth.value >= Breakpoint.LG)
const isLoading = ref(false)

const teams = ref([{ name: '' }])
const settings = reactive<LocalGameSettings>({
  trackDuration: 20,
  gameMode: 'category',
  hostSeesAnswer: false,
  maxRounds: null,
  partialPoints: 2,
  breakDurationBetweenRounds: 3,
  saveGame: settingsStore.defaultSaveGame,
  showTrackCategories: true,
  categoryLimit: 'none',
  generatePlaylistCategories: false,
  generatedCategoryPoints: 10,
  standardPoints: 10,
  trackStartMode: 'random',
  randomStartRange: [10, 90],
  overridePlaybackRange: false,
})

const selectedPlaylistIds = ref<string[]>([])

const gameEnabledTracks = useLiveQuery(
  async () => {
    if (selectedPlaylistIds.value.length === 0)
      return [] as Track[]
    const tracks = await db.tracks.where('playlistIds').anyOf(selectedPlaylistIds.value).toArray()
    return tracks.filter(t =>
      !!t.audioUrl && selectedPlaylistIds.value.some(pid => t.enabledByPlaylist[pid] !== false),
    )
  },
  [] as Track[],
  [selectedPlaylistIds],
)

const gameCategories = useLiveQuery(
  async () => {
    if (selectedPlaylistIds.value.length === 0)
      return [] as Category[]
    return LibraryService.getCategoriesForPlaylists(selectedPlaylistIds.value)
  },
  [] as Category[],
  [selectedPlaylistIds],
)

const hasTracksSelected = computed(() => gameEnabledTracks.value.length > 0)
const hasValidTeams = computed(() =>
  teams.value.length >= 1 && teams.value.every(t => t.name.trim() !== ''),
)
const hasCategories = computed(() => gameCategories.value.length > 0)
const hasAnyCategorySource = computed(() => hasCategories.value || settings.generatePlaylistCategories)

const startButtonText = computed(() => {
  if (!musicPlayerStore.ready)
    return 'Connecting...'
  if (!hasTracksSelected.value)
    return 'Select a playlist'
  if (!hasValidTeams.value)
    return 'Fill in team names'
  if (settings.gameMode === 'category' && !hasAnyCategorySource.value)
    return 'Link a category set to selected playlists'
  if (isLoading.value)
    return 'Loading...'
  return 'Play!'
})

async function handleGameStart() {
  if (!hasValidTeams.value || !hasTracksSelected.value)
    return

  if (settings.gameMode === 'category' && !hasAnyCategorySource.value) {
    toast.error('Link a category set to selected playlists first')
    return
  }

  isLoading.value = true

  try {
    await musicPlayerStore.turnOn()

    const id = await localGameStore.createGame(
      teams.value.map(t => ({ name: t.name.trim() })),
      settings,
      selectedPlaylistIds.value,
      gameCategories.value,
    )

    await localGameStore.startRound()

    router.push({ name: 'localRound', params: { id } })
  }
  catch {
    toast.error('Failed to create game')
    isLoading.value = false
  }
}
</script>

<template>
  <form
    class="
      grid h-[85vh] max-h-[85vh] w-[90vw] grid-rows-[1fr_auto] place-self-center
      lg:h-[80vh] lg:max-h-[80vh] lg:w-auto
      lg:grid-cols-[minmax(200px,400px)_minmax(200px,400px)_minmax(200px,300px)]
      lg:grid-rows-[1fr_50px] lg:items-start lg:gap-5
    "
    @submit.prevent="handleGameStart"
  >
    <Tabs v-if="!isDesktop" class="flex h-full flex-col overflow-hidden" default-value="library">
      <TabsList class="w-full shrink-0">
        <TabsTrigger value="library" class="flex-1">
          Library
        </TabsTrigger>
        <TabsTrigger value="teams" class="flex-1">
          Teams
        </TabsTrigger>
        <TabsTrigger value="settings" class="flex-1">
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="library" class="min-h-0 flex-1">
        <LibraryTrackPicker
          :selected-playlist-ids="selectedPlaylistIds"
          @update:selected-playlist-ids="selectedPlaylistIds = $event"
        />
      </TabsContent>
      <TabsContent value="teams" class="min-h-0 flex-1">
        <TeamManager v-model="teams" />
      </TabsContent>
      <TabsContent value="settings" class="min-h-0 flex-1 overflow-y-auto">
        <LocalGameSettingsForm v-model="settings" :total-tracks="gameEnabledTracks.length" />
      </TabsContent>
    </Tabs>
    <template v-else>
      <LibraryTrackPicker
        :selected-playlist-ids="selectedPlaylistIds"
        @update:selected-playlist-ids="selectedPlaylistIds = $event"
      />
      <TeamManager v-model="teams" />
      <LocalGameSettingsForm v-model="settings" :total-tracks="gameEnabledTracks.length" />
    </template>
    <Button
      class="
        min-w-32 place-self-center
        lg:col-span-3
      "
      :disabled="
        !musicPlayerStore.ready
          || !hasTracksSelected
          || !hasValidTeams
          || (settings.gameMode === 'category' && !hasAnyCategorySource)
          || isLoading
      "
      type="submit"
    >
      {{ startButtonText }}
    </Button>
  </form>
</template>
