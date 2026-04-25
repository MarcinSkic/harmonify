<script setup lang="ts">
import type { Category } from '@/db/schemas'
import { Pencil, Trash2 } from '@lucide/vue'
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
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h3 class="truncate text-lg font-semibold">
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
          <p class="mt-1 text-xs text-muted-foreground">
            {{ trackCount }} {{ trackCount === 1 ? 'track' : 'tracks' }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            @click="emit('edit')"
          >
            <Pencil class="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button type="button" variant="ghost" size="icon">
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

      <div class="flex flex-wrap gap-1.5">
        <Badge
          v-for="tag in category.tagFilter"
          :key="tag"
          variant="outline"
        >
          {{ tag }}
        </Badge>
      </div>
    </CardContent>
  </Card>
</template>
