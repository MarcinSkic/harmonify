<script setup lang="ts">
import type { Category, FieldLimitation, FieldMinDistance, LocalGameSettings } from '@/db/schemas'
import type { FrozenNavidromeTrack, NavidromeGameSourceRef } from '@/services/navidromeGameSource'
import { useWindowSize, watchDebounced } from '@vueuse/core'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePreviewCoverage } from '@/composables/usePreviewCoverage'
import { Breakpoint } from '@/consts'
import { buildCoverageReport } from '@/lib/categoryCoverage'
import { reportNavidromeError } from '@/lib/navidrome'
import { shuffle } from '@/lib/shuffle'
import { applyValuesLimitations } from '@/lib/valuesLimitations'
import { useMusicPlayerStore } from '@/pages/game/stores'
import { useLocalGameStore } from '@/pages/local/stores'
import { LinkPreviewService, NavidromeGameSourceService } from '@/services'
import { useCategoriesStore, useCategorySetsStore, useSettingsStore } from '@/stores'
import LocalGameSettingsForm from './components/LocalGameSettingsForm.vue'
import NavidromeGameSourcePicker from './components/NavidromeGameSourcePicker.vue'
import TeamManager from './components/TeamManager.vue'

const router = useRouter()
const localGameStore = useLocalGameStore()
const musicPlayerStore = useMusicPlayerStore()
const settingsStore = useSettingsStore()
const categoriesStore = useCategoriesStore()
const categorySetsStore = useCategorySetsStore()
const { width: screenWidth } = useWindowSize()

const isDesktop = computed(() => screenWidth.value >= Breakpoint.LG)
const isLoading = ref(false)

const teams = ref([{ name: '' }])
const settings = reactive<LocalGameSettings>({
  trackDuration: 20,
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
const categorySetId = ref<string | null>(null)

// Raw, pre-limits pool from the selected sources (dedup by overlay-disabled tracks still applies —
// those never existed as far as the game is concerned). Debounced because materializePool re-fetches
// every selected source from scratch — without it, picking sources one after another would refetch
// already-fetched ones on every single click (O(n^2) requests).
const pool = ref<FrozenNavidromeTrack[]>([])
const tagsUnavailable = ref(false)
const poolUnavailable = ref(false)
let poolPreviewRequest = 0

// True the instant sources change, false only once the debounced materialization below actually
// lands. Without this gate, "Play!" could freeze whatever stale `limitedPool` happens to be sitting
// around while a fresher fetch is still in flight (decision 1, main plan §7).
const poolPending = ref(false)
watch(selectedSources, () => {
  poolPending.value = true
}, { immediate: true })

watchDebounced(selectedSources, async (sources) => {
  const request = ++poolPreviewRequest

  if (sources.length === 0) {
    pool.value = []
    tagsUnavailable.value = false
    poolUnavailable.value = false
    poolPending.value = false
    return
  }

  try {
    const materialized = await NavidromeGameSourceService.materializePool(sources)
    if (request !== poolPreviewRequest)
      return
    pool.value = materialized.tracks
    tagsUnavailable.value = materialized.tagsUnavailable
    poolUnavailable.value = false
  }
  catch {
    if (request !== poolPreviewRequest)
      return
    // The report must not present zeros as facts when the fetch itself failed.
    pool.value = []
    tagsUnavailable.value = false
    poolUnavailable.value = true
  }
  finally {
    if (request === poolPreviewRequest)
      poolPending.value = false
  }
}, { immediate: true, debounce: 500 })

const poolBeforeLimits = computed(() => pool.value.length)

const isCategoryMode = computed(() => settings.gameMode === 'category')

const selectedCategorySet = computed(() =>
  categorySetId.value
    ? categorySetsStore.categorySets.find(set => set.id === categorySetId.value)
    : undefined,
)

// Random mode carries no category set — gated on the mode, not just on `categorySetId`, because a
// set picked before switching to Random must stop cutting the pool the moment it does (decision 3,
// main plan §7).
const activeLimitations = computed<FieldLimitation[]>(() =>
  isCategoryMode.value ? (selectedCategorySet.value?.valueLimitations ?? []) : [],
)

// Same gate, and only handed to the game being created: unlike the limitations, spacing rules do not
// trim the pool, they only reorder how it is dealt, so nothing shown on this screen depends on them.
const activeMinDistances = computed<FieldMinDistance[]>(() =>
  isCategoryMode.value ? (selectedCategorySet.value?.minDistances ?? []) : [],
)

// `ref` + `watch`, not `computed`: the cut depends on `Math.random()` (via `shuffle`), so it must be
// computed once per change of input and stay stable across re-reads, not reshuffled on every access.
const limitedPool = ref<FrozenNavidromeTrack[]>([])
watch([pool, activeLimitations], ([currentPool, limitations]) => {
  limitedPool.value = applyValuesLimitations(shuffle(currentPool), limitations).admitted
}, { immediate: true })

// Mirrors what createNavidromeGame will actually pool at start, so the round count shown next to
// "Rounds" is not a lie, and so the coverage report is computed on exactly those field bags.
const totalTracks = computed(() => limitedPool.value.length)

// Built on `limitedPool`, like the coverage report: the counter must speak about the tracks a game
// can actually deal, not about ones the value limits already cut.
const previewUrls = computed(() => [
  ...new Set(
    limitedPool.value
      .map(track => track.previewImageUrl)
      .filter((url): url is string => url !== undefined && url !== ''),
  ),
])

const previewCoverage = usePreviewCoverage(previewUrls)

// Fire-and-forget, and debounced for the same reason the pool materialization is: `limitedPool` is
// re-shuffled on every change of the limits, and each run walks the URLs one `get` at a time.
// Failures are logged rather than surfaced — the counter below already says what is missing.
watchDebounced(previewUrls, (urls) => {
  if (urls.length === 0)
    return

  LinkPreviewService.triggerForUrls(urls).catch((error) => {
    console.error('Failed to queue cover previews for the selected pool', error)
  })
}, { immediate: true, debounce: 500 })

const selectedCategories = computed<Category[]>(() => {
  if (!categorySetId.value)
    return []
  return categorySetsStore.getMembersForSet(categorySetId.value)
    .map(member => categoriesStore.categories.find(c => c.id === member.categoryId))
    .filter((category): category is Category => category !== undefined)
})

// Recomputed locally from the already-materialized, already-limited pool — changing the set or the
// round count costs no network traffic, so this needs no debounce of its own. Built on `limitedPool`
// rather than `pool`: from this phase on, coverage counts what a game can actually deal (main plan
// §4.2).
const coverageReport = computed(() =>
  selectedCategories.value.length === 0
    ? null
    : buildCoverageReport(limitedPool.value, selectedCategories.value, settings.maxRounds),
)

const hasSourcesSelected = computed(() => selectedSources.value.length > 0)
const hasValidTeams = computed(() =>
  teams.value.length >= 1 && teams.value.every(t => t.name.trim() !== ''),
)
const hasPlayableCategories = computed(() =>
  coverageReport.value?.perCategory.some(row => row.count > 0) ?? false,
)

const canStart = computed(() =>
  musicPlayerStore.ready
  && hasSourcesSelected.value
  && hasValidTeams.value
  && !isLoading.value
  && !poolPending.value
  && (!isCategoryMode.value || hasPlayableCategories.value),
)

const startButtonText = computed(() => {
  if (!musicPlayerStore.ready)
    return 'Connecting...'
  if (!hasSourcesSelected.value)
    return 'Select an album or playlist'
  if (poolPending.value)
    return 'Loading pool…'
  if (!hasValidTeams.value)
    return 'Fill in team names'
  if (isCategoryMode.value && selectedCategories.value.length === 0)
    return 'Select a category set'
  if (isCategoryMode.value && !hasPlayableCategories.value)
    return 'No tracks match these categories'
  if (isLoading.value)
    return 'Loading...'
  return 'Play!'
})

async function handleGameStart() {
  if (!canStart.value)
    return

  isLoading.value = true

  // Snapshot before the await below: `limitedPool` can still change while `turnOn()` is in flight
  // (e.g. the category sets liveQuery ticks and re-shuffles the cut), and what gets played must be
  // exactly what "Play!" showed at click time (decision 1, main plan §7).
  const gamePool = limitedPool.value

  try {
    await musicPlayerStore.turnOn()

    const id = await localGameStore.createNavidromeGame(
      teams.value.map(t => ({ name: t.name.trim() })),
      settings,
      selectedSources.value,
      selectedCategories.value,
      gamePool,
      activeMinDistances.value,
    )

    await localGameStore.startRound()

    router.push({ name: 'localRound', params: { id } })
  }
  catch (error) {
    reportNavidromeError(error, 'Failed to create game')
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
      lg:grid-rows-[minmax(0,1fr)_50px] lg:gap-5
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
        <LocalGameSettingsForm
          v-model="settings"
          v-model:category-set-id="categorySetId"
          :total-tracks="totalTracks"
          :pool-before-limits="poolBeforeLimits"
          :coverage-report="coverageReport"
          :tags-unavailable="tagsUnavailable"
          :pool-unavailable="poolUnavailable"
          :preview-coverage="previewCoverage"
        />
      </TabsContent>
    </Tabs>
    <template v-else>
      <NavidromeGameSourcePicker v-model:selected="selectedSources" class="
        min-h-0
      "
      />
      <TeamManager v-model="teams" class="min-h-0" />
      <LocalGameSettingsForm
        v-model="settings"
        v-model:category-set-id="categorySetId"
        :total-tracks="totalTracks"
        :pool-before-limits="poolBeforeLimits"
        :coverage-report="coverageReport"
        :tags-unavailable="tagsUnavailable"
        :pool-unavailable="poolUnavailable"
        :preview-coverage="previewCoverage"
        class="min-h-0"
      />
    </template>
    <Button
      class="
        min-w-32 place-self-center
        lg:col-span-3
      "
      :disabled="!canStart"
      type="submit"
    >
      {{ startButtonText }}
    </Button>
  </form>
</template>
