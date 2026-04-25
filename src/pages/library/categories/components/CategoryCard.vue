<script setup lang="ts">
import type { Category } from '@/db/schemas'
import { Music, Pencil, Trash2 } from '@lucide/vue'
import PointsDisplay from '@/components/PointsDisplay.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

defineProps<{
  category: Category
  trackCount: number
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()
</script>

<template>
  <Card>
    <CardContent class="flex flex-col gap-3 p-4">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 class="truncate text-base font-semibold">
              {{ category.displayName }}
            </h3>
            <Badge v-if="category.points !== undefined" variant="secondary">
              <PointsDisplay :points="category.points" />
            </Badge>
          </div>
          <p
            v-if="category.description"
            class="mt-0.5 truncate text-sm text-muted-foreground"
          >
            {{ category.description }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="size-8"
            @click="emit('edit')"
          >
            <Pencil class="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button type="button" variant="ghost" size="icon" class="size-8">
                <Trash2 class="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete category?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the "{{ category.displayName }}" category. Tracks
                  and their tags are not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction @click="emit('delete')">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div class="flex items-end justify-between gap-2">
        <div class="flex flex-wrap gap-1.5">
          <Badge
            v-for="tag in category.tagFilter"
            :key="tag"
            variant="outline"
          >
            {{ tag }}
          </Badge>
        </div>
        <div class="flex shrink-0 items-center gap-1 text-muted-foreground">
          <span class="text-2xl font-bold leading-none">{{ trackCount }}</span>
          <Music class="size-5" />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
