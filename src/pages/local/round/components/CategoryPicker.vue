<script setup lang="ts">
import type { Category, LocalGameTeam } from '@/db/schemas'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import AddTeamInline from './AddTeamInline.vue'
import CategoryProgressRing from './CategoryProgressRing.vue'
import CheatInput from './CheatInput.vue'
import TeamTurnBar from './TeamTurnBar.vue'

const props = defineProps<{
  categories: Array<{ category: Category, count: number, initialCount: number }>
  teams: LocalGameTeam[]
  currentTeamId: string | undefined
}>()

const emit = defineEmits<{
  pick: [categoryId: string]
  selectTeam: [teamId: string]
  toggleTeamDisabled: [teamId: string]
  addTeam: [name: string]
}>()

const currentTeam = computed(() =>
  props.teams.find(t => t.id === props.currentTeamId),
)

function handleClick(categoryId: string, count: number) {
  if (count > 0)
    emit('pick', categoryId)
}
</script>

<template>
  <div
    class="
      grid w-full max-w-3xl gap-4
      lg:max-w-5xl
      xl:max-w-7xl
    "
  >
    <div class="flex flex-wrap items-center justify-center gap-3">
      <TeamTurnBar
        v-if="teams.length > 0"
        :teams="teams"
        :current-team-id="currentTeamId"
        show-disable-control
        @select="(id) => emit('selectTeam', id)"
        @toggle-disabled="(id: string) => emit('toggleTeamDisabled', id)"
      />
      <AddTeamInline @add="emit('addTeam', $event)" />
    </div>

    <h2
      class="
        text-center text-2xl font-bold wrap-break-word
        lg:text-4xl
      "
    >
      <template v-if="currentTeam">
        <span
          class="
            inline-block max-w-xs truncate align-bottom text-primary
            lg:max-w-md
          "
        >{{ currentTeam.name }}</span>
        picks a category
      </template>
      <template v-else>
        Pick a category
      </template>
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
        lg:gap-4
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
        <CardContent
          class="
            flex flex-col items-center gap-3 p-4 text-center
            lg:p-6
          "
        >
          <CategoryProgressRing :current="count" :initial="initialCount" />
          <span
            class="
              text-lg font-semibold
              lg:text-2xl
            "
          >{{ category.displayName }}</span>
          <span
            v-if="category.description"
            class="
              text-xs text-muted-foreground
              lg:text-sm
            "
          >
            {{ category.description }}
          </span>
          <Badge v-if="category.points !== undefined" variant="secondary">
            {{ category.points }} pts
          </Badge>
        </CardContent>
      </Card>
    </div>

    <CheatInput />
  </div>
</template>
