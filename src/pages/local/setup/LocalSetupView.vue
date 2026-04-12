<script setup lang="ts">
import type { LocalGameSettings } from '@/db/schemas'
import { useWindowSize } from '@vueuse/core'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Breakpoint } from '@/consts'
import LibraryTrackPicker from '@/pages/game/setup/components/LibraryTrackPicker.vue'
import { useMusicPlayerStore } from '@/pages/game/stores'
import { useLocalGameStore } from '@/pages/local/stores'
import { useCategoriesStore, useLibraryStore } from '@/stores'
import LocalGameSettingsForm from './components/LocalGameSettingsForm.vue'
import TeamManager from './components/TeamManager.vue'

const router = useRouter()
const localGameStore = useLocalGameStore()
const libraryStore = useLibraryStore()
const categoriesStore = useCategoriesStore()
const musicPlayerStore = useMusicPlayerStore()
const { width: screenWidth } = useWindowSize()

const isDesktop = computed(() => screenWidth.value >= Breakpoint.LG)
const isLoading = ref(false)

const teams = ref([{ name: '' }])
const settings = reactive<LocalGameSettings>({
  trackDuration: 10,
  gameMode: 'random',
  hostSeesAnswer: false,
  hideScores: false,
  maxRounds: 10,
})

const hasTracksSelected = computed(() => libraryStore.enabledTracks.length > 0)
const hasValidTeams = computed(() =>
  teams.value.length >= 1 && teams.value.every(t => t.name.trim() !== ''),
)
const hasEnabledCategories = computed(() =>
  categoriesStore.enabledCategories.length > 0,
)

const startButtonText = computed(() => {
  if (!musicPlayerStore.ready)
    return 'Connecting...'
  if (!hasTracksSelected.value)
    return 'Select a playlist'
  if (!hasValidTeams.value)
    return 'Fill in team names'
  if (settings.gameMode === 'category' && !hasEnabledCategories.value)
    return 'Create a category first'
  if (isLoading.value)
    return 'Loading...'
  return 'Play!'
})

async function handleGameStart() {
  if (!hasValidTeams.value || !hasTracksSelected.value)
    return

  if (settings.gameMode === 'category' && !hasEnabledCategories.value) {
    toast.error('Create an enabled category in the library first')
    return
  }

  isLoading.value = true

  try {
    await musicPlayerStore.turnOn()

    const selectedPlaylistIds = libraryStore.selectedPlaylistId
      ? [libraryStore.selectedPlaylistId]
      : libraryStore.playlists.map(p => p.id)

    const id = await localGameStore.createGame(
      teams.value.map(t => ({ name: t.name.trim() })),
      settings,
      selectedPlaylistIds,
      categoriesStore.enabledCategories,
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
      grid h-[80vh] max-h-[80vh] w-[80vw] place-self-center
      lg:w-auto lg:grid-cols-[minmax(auto,600px)_270px] lg:grid-rows-[1fr_50px]
      lg:items-start lg:gap-5
    "
    @submit.prevent="handleGameStart"
  >
    <Tabs v-if="!isDesktop" default-value="tracks">
      <TabsList class="w-full">
        <TabsTrigger value="tracks" class="flex-1">
          Library
        </TabsTrigger>
        <TabsTrigger value="settings" class="flex-1">
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tracks" class="h-[60vh]">
        <LibraryTrackPicker />
      </TabsContent>
      <TabsContent value="settings" class="h-[60vh] space-y-4 overflow-y-auto">
        <TeamManager v-model="teams" />
        <LocalGameSettingsForm v-model="settings" :total-tracks="libraryStore.enabledTracks.length" />
      </TabsContent>
    </Tabs>
    <template v-else>
      <LibraryTrackPicker />
      <div class="space-y-4">
        <TeamManager v-model="teams" />
        <LocalGameSettingsForm v-model="settings" :total-tracks="libraryStore.enabledTracks.length" />
      </div>
    </template>
    <Button
      class="min-w-32 place-self-center"
      :disabled="
        !musicPlayerStore.ready
          || !hasTracksSelected
          || !hasValidTeams
          || (settings.gameMode === 'category' && !hasEnabledCategories)
          || isLoading
      "
      type="submit"
    >
      {{ startButtonText }}
    </Button>
  </form>
</template>
