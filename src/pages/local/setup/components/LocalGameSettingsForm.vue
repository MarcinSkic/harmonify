<script setup lang="ts">
import type { LocalGameSettings } from '@/db/schemas'
import { Infinity as InfinityIcon, Slash } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import Switch from '@/components/ui/switch/Switch.vue'

defineProps<{
  totalTracks: number
}>()

const settings = defineModel<LocalGameSettings>({ required: true })

const isUnlimitedRounds = computed(() => settings.value.maxRounds === null)

function toggleUnlimitedRounds() {
  settings.value.maxRounds = isUnlimitedRounds.value ? 10 : null
}
</script>

<template>
  <div
    class="
      grid h-full auto-rows-min items-start gap-2 rounded-lg border px-5 py-4
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
          :class="{ 'bg-accent': isUnlimitedRounds }"
          @click="toggleUnlimitedRounds"
        >
          <InfinityIcon class="size-4" />
        </Button>
      </div>

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

      <Label class="text-base">Host sees answer</Label>
      <Switch v-model:model-value="settings.hostSeesAnswer" class="mb-2" />

      <Label class="text-base">Hide scores</Label>
      <Switch v-model:model-value="settings.hideScores" class="mb-2" />
    </div>
  </div>
</template>
