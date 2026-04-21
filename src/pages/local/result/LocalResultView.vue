<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import GameResultTabs from '@/pages/local/components/GameResultTabs.vue'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()

const teams = computed(() =>
  localGameStore.sortedTeams.map(t => ({ id: t.id, name: t.name, score: t.score })),
)

onMounted(async () => {
  if (!localGameStore.game) {
    const gameId = router.currentRoute.value.params.id as string
    const restored = await localGameStore.resumeGame(gameId)
    if (!restored)
      router.push({ name: 'localSetup' })
  }
})
</script>

<template>
  <div
    v-if="localGameStore.game"
    class="
      grid h-full grid-rows-[auto_1fr_auto] gap-8 p-4
      md:p-8
    "
  >
    <h1
      class="
        text-center text-3xl font-bold
        lg:text-5xl
      "
    >
      Game Finished
    </h1>

    <GameResultTabs :teams="teams" :rounds="localGameStore.game.rounds" />

    <div class="flex justify-center gap-3">
      <Button @click="router.push({ name: 'localSetup' })">
        New game
      </Button>
      <Button variant="outline" @click="router.push({ name: 'home' })">
        Back to menu
      </Button>
    </div>
  </div>
</template>
