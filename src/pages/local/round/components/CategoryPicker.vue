<script setup lang="ts">
import type { Category } from '@/db/schemas'
import { KeyRound } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import CategoryProgressRing from './CategoryProgressRing.vue'

const props = defineProps<{
  categories: Array<{ category: Category, count: number, initialCount: number }>
  onCheckSourceId?: (sourceId: string) => Promise<'available' | 'already-played' | 'not-found'>
  onPlaySpecificTrack?: (sourceId: string) => Promise<'played' | 'already-played' | 'not-found'>
}>()

const emit = defineEmits<{
  pick: [categoryId: string]
}>()

const cheatOpen = ref(false)
const cheatSourceId = ref('')
const cheatStatus = ref<{ type: 'error' | 'warning', message: string } | null>(null)

watchDebounced(cheatSourceId, async (value) => {
  const trimmed = value.trim()
  if (!trimmed) {
    cheatStatus.value = null
    return
  }

  const result = await props.onCheckSourceId?.(trimmed)
  if (result === 'not-found')
    cheatStatus.value = { type: 'error', message: `Track not found for sourceId: ${trimmed}` }
  else if (result === 'already-played')
    cheatStatus.value = { type: 'warning', message: 'This track was already played' }
  else
    cheatStatus.value = null
}, { debounce: 300 })

function handleClick(categoryId: string, count: number) {
  if (count > 0)
    emit('pick', categoryId)
}

async function handleCheatSubmit() {
  const value = cheatSourceId.value.trim()
  if (!value || cheatStatus.value?.type === 'error')
    return

  await props.onPlaySpecificTrack?.(value)
}
</script>

<template>
  <div class="grid w-full max-w-3xl gap-4">
    <h2 class="text-center text-2xl font-bold">
      Pick a category
    </h2>
    <div
      v-if="categories.length === 0"
      class="text-center text-muted-foreground"
    >
      No categories available
    </div>
    <div
      v-else
      class="
        grid grid-cols-2 gap-3
        sm:grid-cols-3
        md:grid-cols-4
      "
    >
      <Card
        v-for="{ category, count, initialCount } in categories"
        :key="category.id"
        class="transition" :class="[
          count > 0
            ? `
              cursor-pointer
              hover:border-primary
            `
            : 'pointer-events-none opacity-40',
        ]"
        :data-testid="`category-${category.id}`"
        @click="handleClick(category.id, count)"
      >
        <CardContent class="flex flex-col items-center gap-3 p-4 text-center">
          <CategoryProgressRing :current="count" :initial="initialCount" />
          <span class="text-lg font-semibold">{{ category.displayName }}</span>
          <span
            v-if="category.description"
            class="text-xs text-muted-foreground"
          >
            {{ category.description }}
          </span>
          <Badge v-if="category.points !== undefined" variant="secondary">
            {{ category.points }} pts
          </Badge>
        </CardContent>
      </Card>
    </div>

    <div class="flex flex-col items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground"
        @click="cheatOpen = !cheatOpen"
      >
        <KeyRound class="mr-1 size-4" />
        Play specific track
      </Button>
      <template v-if="cheatOpen">
        <form
          class="flex w-full max-w-sm gap-2"
          @submit.prevent="handleCheatSubmit"
        >
          <Input
            v-model="cheatSourceId"
            placeholder="Paste sourceId..."
            class="flex-1"
          />
          <Button type="submit" size="sm" :disabled="!cheatSourceId.trim() || cheatStatus?.type === 'error'">
            Play
          </Button>
        </form>
        <p
          v-if="cheatStatus"
          class="text-sm" :class="[
            cheatStatus.type === 'error' ? 'text-destructive' : `
              text-yellow-500
            `,
          ]"
        >
          {{ cheatStatus.message }}
        </p>
      </template>
    </div>
  </div>
</template>
