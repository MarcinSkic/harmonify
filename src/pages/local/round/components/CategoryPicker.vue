<script setup lang="ts">
import type { Category } from '@/db/schemas'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import CategoryProgressRing from './CategoryProgressRing.vue'
import CheatInput from './CheatInput.vue'

defineProps<{
  categories: Array<{ category: Category, count: number, initialCount: number }>
}>()

const emit = defineEmits<{
  pick: [categoryId: string]
}>()

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
    <h2
      class="
        text-center text-2xl font-bold
        lg:text-4xl
      "
    >
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
