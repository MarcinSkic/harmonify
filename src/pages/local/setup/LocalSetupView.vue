<script setup lang="ts">
import type { LocalGameSettings } from '@/db/schemas'
import type { NavidromeGameSourceRef } from '@/services/navidromeGameSource'
import { useWindowSize, watchDebounced } from '@vueuse/core'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Breakpoint } from '@/consts'
import { useMusicPlayerStore } from '@/pages/game/stores'
import { useLocalGameStore } from '@/pages/local/stores'
import { NavidromeGameSourceService } from '@/services'
import { useSettingsStore } from '@/stores'
import LocalGameSettingsForm from './components/LocalGameSettingsForm.vue'
import NavidromeGameSourcePicker from './components/NavidromeGameSourcePicker.vue'
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
  // Category mode is Navidrome-tag-based work for Phase 2 — this picker only offers random.
  gameMode: 'random',
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

const selectedSources = ref<NavidromeGameSourceRef[]>([])

// Mirrors what createNavidromeGame will actually pool at start (dedup + overlay-disabled tracks
// excluded), so the round count shown next to "Rounds" is not a lie. Debounced because
// materializePool re-fetches every selected source from scratch — without it, picking sources one
// after another would refetch already-fetched ones on every single click (O(n^2) requests).
const totalTracks = ref(0)
let poolPreviewRequest = 0

watchDebounced(selectedSources, async (sources) => {
  const request = ++poolPreviewRequest

  if (sources.length === 0) {
    totalTracks.value = 0
    return
  }

  try {
    const pool = await NavidromeGameSourceService.materializePool(sources)
    if (request === poolPreviewRequest)
      totalTracks.value = pool.length
  }
  catch {
    if (request === poolPreviewRequest)
      totalTracks.value = 0
  }
}, { immediate: true, debounce: 500 })

const hasSourcesSelected = computed(() => selectedSources.value.length > 0)
const hasValidTeams = computed(() =>
  teams.value.length >= 1 && teams.value.every(t => t.name.trim() !== ''),
)

const startButtonText = computed(() => {
  if (!musicPlayerStore.ready)
    return 'Connecting...'
  if (!hasSourcesSelected.value)
    return 'Select an album or playlist'
  if (!hasValidTeams.value)
    return 'Fill in team names'
  if (isLoading.value)
    return 'Loading...'
  return 'Play!'
})

async function handleGameStart() {
  if (!hasValidTeams.value || !hasSourcesSelected.value)
    return

  isLoading.value = true

  try {
    await musicPlayerStore.turnOn()

    const id = await localGameStore.createNavidromeGame(
      teams.value.map(t => ({ name: t.name.trim() })),
      settings,
      selectedSources.value,
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
      lg:grid-rows-[1fr_50px] lg:gap-5
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
      <TabsContent value="library" class="flex min-h-0 flex-1 flex-col">
        <NavidromeGameSourcePicker v-model:selected="selectedSources" />
      </TabsContent>
      <TabsContent value="teams" class="flex min-h-0 flex-1 flex-col">
        <TeamManager v-model="teams" />
      </TabsContent>
      <TabsContent value="settings" class="
        flex min-h-0 flex-1 flex-col overflow-y-auto
      "
      >
        <LocalGameSettingsForm v-model="settings" :total-tracks="totalTracks" />
      </TabsContent>
    </Tabs>
    <template v-else>
      <NavidromeGameSourcePicker v-model:selected="selectedSources" />
      <TeamManager v-model="teams" />
      <LocalGameSettingsForm v-model="settings" :total-tracks="totalTracks" />
    </template>
    <Button
      class="
        min-w-32 place-self-center
        lg:col-span-3
      "
      :disabled="
        !musicPlayerStore.ready
          || !hasSourcesSelected
          || !hasValidTeams
          || isLoading
      "
      type="submit"
    >
      {{ startButtonText }}
    </Button>
  </form>
</template>
