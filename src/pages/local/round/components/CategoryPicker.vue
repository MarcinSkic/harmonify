<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

defineProps<{
  categories: Array<{ tag: string, count: number }>
}>()

const emit = defineEmits<{
  pick: [tag: string]
}>()

function handleClick(tag: string, count: number) {
  if (count > 0)
    emit('pick', tag)
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
        v-for="cat in categories"
        :key="cat.tag"
        class="transition" :class="[
          cat.count > 0
            ? `
              cursor-pointer
              hover:border-primary
            `
            : 'pointer-events-none opacity-40',
        ]"
        :data-testid="`category-${cat.tag}`"
        @click="handleClick(cat.tag, cat.count)"
      >
        <CardContent class="flex flex-col items-center gap-2 p-4">
          <span class="text-lg font-semibold">{{ cat.tag }}</span>
          <Badge :variant="cat.count > 0 ? 'secondary' : 'outline'">
            {{ cat.count }} left
          </Badge>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
