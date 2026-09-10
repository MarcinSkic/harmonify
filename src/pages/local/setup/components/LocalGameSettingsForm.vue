<script setup lang="ts">
import type { PreviewCoverage } from '@/composables/usePreviewCoverage'
import type { CategoryLimit, LocalGameSettings } from '@/db/schemas'
import type { CoverageReport as CoverageReportData } from '@/lib/categoryCoverage'
import { Infinity as InfinityIcon, RotateCcw, Shuffle, Slash, Star, TriangleAlert } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import { Slider } from '@/components/ui/slider'
import Switch from '@/components/ui/switch/Switch.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import CategorySetPicker from './CategorySetPicker.vue'
import CoverageReport from './CoverageReport.vue'

defineProps<{
  totalTracks: number
  /** Pool size before `valueLimitations` trims it — same as `totalTracks` when no limits apply. */
  poolBeforeLimits: number
  coverageReport: CoverageReportData | null
  tagsUnavailable: boolean
  poolUnavailable: boolean
  /** Cover preview progress for the pool — reported in both game modes, unlike `coverageReport`. */
  previewCoverage: PreviewCoverage
}>()

const settings = defineModel<LocalGameSettings>({ required: true })
const categorySetId = defineModel<string | null>('categorySetId', { required: true })

const isUnlimitedRounds = computed(() => settings.value.maxRounds === null)

function toggleUnlimitedRounds() {
  settings.value.maxRounds = isUnlimitedRounds.value ? 10 : null
}
</script>

<template>
  <div
    class="
      grid h-full auto-rows-min items-start gap-2 overflow-y-auto rounded-lg
      border px-5 py-4
    "
  >
    <h2
      class="
        mb-2 text-center text-xl font-bold
        lg:text-3xl
      "
    >
      Game settings
    </h2>
    <div
      class="
        grid grid-cols-1 items-center justify-start justify-items-start gap-y-1
        sm:grid-cols-[minmax(0,1fr)_auto]
        lg:grid-cols-1
      "
    >
      <Label class="grow text-base" for="maxRounds">Rounds</Label>
      <div
        class="
          mb-2 flex w-full items-center gap-2
          sm:w-56
          lg:w-full
        "
      >
        <NumberField
          v-if="!isUnlimitedRounds"
          id="maxRounds"
          v-model:model-value="settings.maxRounds!"
          class="flex flex-1 items-stretch gap-0"
          :min="1"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput class="rounded-r-none" />
            <NumberFieldIncrement />
          </NumberFieldContent>
          <div
            class="
              flex w-max items-center rounded-r-md border border-l-0 bg-muted
              pr-3 text-muted-foreground
            "
          >
            <Slash class="size-5 rotate-[-32deg]" />
            <span class="mr-1 text-nowrap">{{ totalTracks }} tracks</span>
          </div>
        </NumberField>
        <span v-else class="flex-1 text-sm text-muted-foreground">Until pool exhausted</span>
        <Button
          variant="outline"
          size="icon"
          type="button"
          :class="isUnlimitedRounds ? `
            bg-primary text-primary-foreground
            hover:bg-primary/90
          ` : ''"
          @click="toggleUnlimitedRounds"
        >
          <InfinityIcon class="size-4" />
        </Button>
      </div>

      <p
        v-if="poolBeforeLimits > totalTracks"
        class="
          -mt-1 mb-2 text-xs text-muted-foreground
          sm:col-span-2
          lg:col-span-1
        "
      >
        {{ poolBeforeLimits }} → {{ totalTracks }} tracks after value limits
      </p>

      <p
        v-if="poolBeforeLimits > 0 && settings.maxRounds !== null && totalTracks < settings.maxRounds"
        class="
          mb-2 flex items-start gap-1.5 text-xs text-destructive
          sm:col-span-2
          lg:col-span-1
        "
      >
        <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
        Pool holds fewer tracks than the planned number of rounds.
      </p>

      <p
        v-if="poolUnavailable"
        class="
          mb-2 flex items-start gap-1.5 text-sm text-destructive
          sm:col-span-2
          lg:col-span-1
        "
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0" />
        Could not load the selected sources from Navidrome.
      </p>

      <p
        v-if="previewCoverage.pending > 0"
        class="
          mb-2 text-xs text-muted-foreground
          sm:col-span-2
          lg:col-span-1
        "
      >
        Fetching cover previews… {{ previewCoverage.ready }} of {{ previewCoverage.total }} ready
      </p>

      <p
        v-if="previewCoverage.failed > 0"
        class="
          mb-2 flex items-start gap-1.5 text-xs text-destructive
          sm:col-span-2
          lg:col-span-1
        "
      >
        <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
        Could not fetch {{ previewCoverage.failed }} of {{ previewCoverage.total }} cover previews —
        those tracks will fall back to the album cover, fix their URLs in the library.
      </p>

      <Label for="trackDuration" class="text-base">Track duration</Label>
      <NumberField
        id="trackDuration"
        v-model:model-value="settings.trackDuration"
        class="
          mb-2 flex w-full items-stretch gap-0 justify-self-end
          sm:w-40
          lg:w-full
        "
        :min="1"
        :max="30"
      >
        <NumberFieldContent>
          <NumberFieldDecrement />
          <NumberFieldInput class="rounded-r-none" />
          <NumberFieldIncrement />
        </NumberFieldContent>
        <div
          class="
            flex w-max items-center rounded-r-md border border-l-0 bg-muted px-3
            text-muted-foreground
          "
        >
          <span>s</span>
        </div>
      </NumberField>

      <Label class="text-base">Game mode</Label>
      <div class="mb-2 flex w-full gap-2">
        <Button
          type="button"
          class="flex-1"
          :variant="settings.gameMode === 'random' ? 'default' : 'outline'"
          @click="settings.gameMode = 'random'"
        >
          Random
        </Button>
        <Button
          type="button"
          class="flex-1"
          :variant="settings.gameMode === 'category' ? 'default' : 'outline'"
          @click="settings.gameMode = 'category'"
        >
          Categories
        </Button>
      </div>

      <template v-if="settings.gameMode === 'random'">
        <Label for="standardPoints" class="text-base">Standard points</Label>
        <NumberField
          id="standardPoints"
          v-model:model-value="settings.standardPoints"
          class="
            mb-2 flex w-full items-stretch gap-0 justify-self-end
            sm:w-40
            lg:w-full
          "
          :min="1"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput class="rounded-r-none" />
            <NumberFieldIncrement />
          </NumberFieldContent>
          <div
            class="
              flex w-max items-center rounded-r-md border border-l-0 bg-muted
              px-3 text-muted-foreground
            "
          >
            <Star class="size-4" />
          </div>
        </NumberField>
      </template>

      <template v-if="settings.gameMode === 'category'">
        <Label class="text-base">Category set</Label>
        <CategorySetPicker
          v-model="categorySetId"
          class="
            mb-2
            sm:w-56
            lg:w-full
          "
        />

        <Label class="text-base">Coverage</Label>
        <CoverageReport
          :report="coverageReport"
          :tags-unavailable="tagsUnavailable"
          class="
            mb-2
            sm:col-span-2
            lg:col-span-1
          "
        />

        <Label class="text-base">Category limits</Label>
        <ToggleGroup
          type="single"
          class="mb-2 w-full"
          :model-value="settings.categoryLimit"
          @update:model-value="(v) => v && (settings.categoryLimit = v as CategoryLimit)"
        >
          <ToggleGroupItem
            value="none" class="
              flex-1 gap-1.5
              data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
            "
          >
            <InfinityIcon class="size-4" /> No limits
          </ToggleGroupItem>
          <ToggleGroupItem
            value="no-streak" class="
              flex-1 gap-1.5
              data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
            "
          >
            <Shuffle class="size-4" /> No streak
          </ToggleGroupItem>
          <ToggleGroupItem
            value="once" class="
              flex-1 gap-1.5
              data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
            "
          >
            <RotateCcw class="size-4" /> Once each
          </ToggleGroupItem>
        </ToggleGroup>
      </template>

      <Label class="text-base">Track start</Label>
      <div class="mb-2 flex w-full gap-2">
        <Button
          type="button"
          class="flex-1"
          :variant="settings.trackStartMode === 'beginning' ? 'default' : 'outline'"
          @click="settings.trackStartMode = 'beginning'"
        >
          From start
        </Button>
        <Button
          type="button"
          class="flex-1"
          :variant="settings.trackStartMode === 'random' ? 'default' : 'outline'"
          @click="settings.trackStartMode = 'random'"
        >
          Random
        </Button>
      </div>

      <template v-if="settings.trackStartMode === 'random'">
        <Label class="text-base">
          Random start range: {{ settings.randomStartRange[0] }}% – {{ settings.randomStartRange[1] }}%
        </Label>
        <Slider
          class="mb-2"
          :min="0"
          :max="100"
          :step="5"
          :model-value="settings.randomStartRange"
          @update:model-value="(v) => v && (settings.randomStartRange = v as [number, number])"
        />
      </template>

      <Label class="text-base">Override track range</Label>
      <Switch v-model:model-value="settings.overridePlaybackRange" class="mb-2" />

      <Label for="partialPoints" class="text-base">Partial points (bonus)</Label>
      <NumberField
        id="partialPoints"
        v-model:model-value="settings.partialPoints"
        class="
          mb-2 flex w-full items-stretch gap-0 justify-self-end
          sm:w-40
          lg:w-full
        "
        :min="0"
      >
        <NumberFieldContent>
          <NumberFieldDecrement />
          <NumberFieldInput class="rounded-r-none" />
          <NumberFieldIncrement />
        </NumberFieldContent>
        <div
          class="
            flex w-max items-center rounded-r-md border border-l-0 bg-muted px-3
            text-muted-foreground
          "
        >
          <Star class="size-4" />
        </div>
      </NumberField>

      <Label for="breakDurationBetweenRounds" class="text-base">Leaderboard duration</Label>
      <NumberField
        id="breakDurationBetweenRounds"
        v-model:model-value="settings.breakDurationBetweenRounds"
        class="
          mb-2 flex w-full items-stretch gap-0 justify-self-end
          sm:w-40
          lg:w-full
        "
        :min="1"
      >
        <NumberFieldContent>
          <NumberFieldDecrement />
          <NumberFieldInput class="rounded-r-none" />
          <NumberFieldIncrement />
        </NumberFieldContent>
        <div
          class="
            flex w-max items-center rounded-r-md border border-l-0 bg-muted px-3
            text-muted-foreground
          "
        >
          <span>s</span>
        </div>
      </NumberField>

      <Label class="text-base">Show track categories</Label>
      <Switch v-model:model-value="settings.showTrackCategories" class="mb-2" />

      <Label class="text-base">Host sees answer</Label>
      <Switch v-model:model-value="settings.hostSeesAnswer" class="mb-2" />

      <Label class="text-base">Save game results</Label>
      <Switch v-model:model-value="settings.saveGame" class="mb-2" />
    </div>
  </div>
</template>
