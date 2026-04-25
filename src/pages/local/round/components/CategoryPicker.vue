<script setup lang="ts">
import type { Category, LocalGameTeam, PlaylistBasedCategory } from '@/db/schemas'
import { useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'
import PointsDisplay from '@/components/PointsDisplay.vue'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Breakpoint } from '@/consts'
import AddTeamInline from './AddTeamInline.vue'
import CategoryProgressRing from './CategoryProgressRing.vue'
import CheatInput from './CheatInput.vue'
import TeamTurnBar from './TeamTurnBar.vue'

const props = defineProps<{
  categories: Array<{ category: Category | PlaylistBasedCategory, count: number, initialCount: number }>
  teams: LocalGameTeam[]
  currentTeamId: string | undefined
  disabledCategoryIds?: Set<string>
}>()

const emit = defineEmits<{
  pick: [categoryId: string]
  selectTeam: [teamId: string]
  toggleTeamDisabled: [teamId: string]
  addTeam: [name: string]
}>()
const MAX_ROWS = 4

const breakpoints = useBreakpoints({ sm: Breakpoint.SM, md: Breakpoint.MD, lg: Breakpoint.LG, xl: Breakpoint.XL })

const baseCols = computed(() => {
  if (breakpoints.greaterOrEqual('md').value)
    return 4
  if (breakpoints.greaterOrEqual('sm').value)
    return 3
  return 2
})

const cols = computed(() =>
  Math.max(baseCols.value, Math.ceil(props.categories.length / MAX_ROWS)),
)

const columnWidth = computed(() => {
  if (breakpoints.greaterOrEqual('xl').value)
    return 420
  if (breakpoints.greaterOrEqual('lg').value)
    return 340
  return 240
})

const containerMaxWidth = computed(() => `${cols.value * columnWidth.value}px`)

const currentTeam = computed(() =>
  props.teams.find(t => t.id === props.currentTeamId),
)

function isCategoryDisabled(categoryId: string, count: number) {
  return count === 0 || (props.disabledCategoryIds?.has(categoryId) ?? false)
}

function handleClick(categoryId: string, count: number) {
  if (!isCategoryDisabled(categoryId, count))
    emit('pick', categoryId)
}
</script>

<template>
  <div
    class="grid w-full gap-4"
    :style="{ maxWidth: containerMaxWidth }"
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
        grid gap-3
        lg:gap-4
      "
      :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
    >
      <Card
        v-for="{ category, count, initialCount } in categories"
        :key="category.id"
        class="transition" :class="[
          !isCategoryDisabled(category.id, count)
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
            v-if="'description' in category && category.description"
            class="
              text-xs text-muted-foreground
              lg:text-sm
            "
          >
            {{ (category as { description?: string }).description }}
          </span>
          <Badge
            v-if="category.points !== undefined" variant="secondary" class="
              px-3 py-1 text-xl
              lg:px-3 lg:py-1 lg:text-2xl
            "
          >
            <PointsDisplay :points="category.points" icon-class="size-5 lg:size-6" />
          </Badge>
        </CardContent>
      </Card>
    </div>

    <CheatInput />
  </div>
</template>
