<script setup lang="ts">
import { Calendar, Download, Trash2, Users } from '@lucide/vue'
import { Button } from '@/components/ui/button'

defineProps<{
  date: number
  teams: number
  info: string
  showExport?: boolean
}>()

const emit = defineEmits<{
  click: []
  delete: []
  export: []
}>()

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div
    class="
      flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2
      transition-colors
      hover:bg-accent hover:text-accent-foreground
    "
    @click="emit('click')"
  >
    <div class="min-w-0 flex-1 space-y-1">
      <p class="flex items-center gap-1.5 text-sm font-medium">
        <Calendar class="size-3.5 shrink-0 text-muted-foreground" />
        {{ formatDate(date) }}
      </p>
      <p class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="flex items-center gap-1">
          <Users class="size-3.5 shrink-0" />
          {{ teams }} {{ teams === 1 ? 'team' : 'teams' }}
        </span>
        <span>{{ info }}</span>
      </p>
    </div>
    <Button
      v-if="showExport"
      variant="ghost"
      size="icon"
      class="shrink-0"
      @click.stop="emit('export')"
    >
      <Download class="size-4" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class="shrink-0"
      @click.stop="emit('delete')"
    >
      <Trash2 class="size-4" />
    </Button>
  </div>
</template>
