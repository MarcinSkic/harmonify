<script setup lang="ts">
import type { PlayerScoreDto } from '@/types'
import { computed } from 'vue'
import TeamScoreItem from '@/components/TeamScoreItem.vue'
import { GuessDisplay } from '@/pages/game/components/trackDisplay'
import { useGameDataStore } from '@/stores'

const props = defineProps<{
  animation?: false | { duration: string }
  playerResult: PlayerScoreDto & { width: number }
  displayGuessLevel?: boolean
}>()

const gameDataStore = useGameDataStore()
const guess = computed(() => props.playerResult.roundResults.at(-1)!.guess)
const guessLevel = computed(() => props.playerResult.roundResults.at(-1)!.guessLevel)
const isSelf = computed(() => props.playerResult.guid === gameDataStore.selfPlayer.guid)
</script>

<template>
  <TeamScoreItem
    :name="playerResult.nickname"
    :score="playerResult.score"
    :width="playerResult.width"
    :guess-level="guessLevel"
    :display-guess-level="displayGuessLevel"
    :highlighted="isSelf"
    :animation="animation"
  >
    <div
      v-if="displayGuessLevel && guessLevel !== 'full' && guess !== ''" class="
        text-sm text-nowrap
      "
    >
      <span>Guess: </span>
      <GuessDisplay :guess="guess" />
    </div>
  </TeamScoreItem>
</template>
