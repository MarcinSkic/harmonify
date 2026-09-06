<script setup lang="ts">
import type { Category } from '@/db/schemas'
import { Pencil, Trash2 } from '@lucide/vue'
import { computed } from 'vue'
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
import { formatMatch } from '@/lib/categoryPredicate'

const props = defineProps<{
  category: Category
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const conditions = computed(() => formatMatch(props.category.match))
const connective = computed(() => 'all' in props.category.match ? 'and' : 'or')
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

      <div class="flex flex-wrap items-center gap-1.5">
        <template v-for="(condition, index) in conditions" :key="index">
          <span v-if="index > 0" class="text-xs text-muted-foreground">
            {{ connective }}
          </span>
          <Badge variant="outline" class="font-mono">
            {{ condition }}
          </Badge>
        </template>
      </div>
    </CardContent>
  </Card>
</template>
