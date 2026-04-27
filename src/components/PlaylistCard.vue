<script setup lang="ts">
import { ListMusic } from '@lucide/vue'
import CheckableCard from '@/components/spotify/CheckableCard.vue'
import { Badge } from '@/components/ui/badge'

defineProps<{
  imageUrl?: string
  name: string
  trackCount: number | string
}>()

const selected = defineModel<boolean>({ required: true })
</script>

<template>
  <div class="flex flex-col items-stretch gap-1">
    <CheckableCard
      :id="name"
      v-model="selected"
      :src="imageUrl"
      :alt="name"
      :title="name"
    >
      <ListMusic :size="40" class="text-muted-foreground" />
    </CheckableCard>
    <Badge variant="secondary" class="shrink-0 self-center">
      {{ trackCount }}
    </Badge>
  </div>
</template>
