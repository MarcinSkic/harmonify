<script setup lang="ts">
import type { LocalGameTeam } from '@/db/schemas'
import { Eye, EyeOff } from '@lucide/vue'
import { cn } from '@/lib/utils'

withDefaults(defineProps<{
  teams: LocalGameTeam[]
  currentTeamId: string | undefined
  showDisableControl?: boolean
}>(), {
  showDisableControl: false,
})

const emit = defineEmits<{
  select: [teamId: string]
  toggleDisabled: [teamId: string]
}>()

function handleChipClick(team: LocalGameTeam) {
  if (team.disabled)
    return
  emit('select', team.id)
}

function handleToggleClick(team: LocalGameTeam) {
  emit('toggleDisabled', team.id)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2">
    <div
      v-for="team in teams"
      :key="team.id"
      :class="cn(
        `
          flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm
          font-medium transition
        `,
        team.disabled
          ? 'cursor-not-allowed border-border bg-muted line-through opacity-40'
          : team.id === currentTeamId
            ? `
              scale-105 cursor-pointer border-primary bg-primary
              text-primary-foreground shadow-sm
            `
            : `
              cursor-pointer border-border bg-secondary
              text-secondary-foreground
              hover:border-primary hover:bg-primary/20
            `,
      )"
      @click="handleChipClick(team)"
    >
      <span class="max-w-40 truncate">{{ team.name }}</span>
      <button
        v-if="showDisableControl"
        type="button"
        class="
          -mr-1 grid size-5 place-items-center rounded-sm
          hover:bg-black/10
        "
        :aria-label="team.disabled ? `Enable ${team.name}` : `Disable ${team.name}`"
        @click.stop="handleToggleClick(team)"
      >
        <EyeOff v-if="!team.disabled" class="size-3.5" />
        <Eye v-else class="size-3.5" />
      </button>
    </div>
  </div>
</template>
