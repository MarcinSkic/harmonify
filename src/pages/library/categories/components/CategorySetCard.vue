<script setup lang="ts">
import type { CategorySet, CategorySetMember } from '@/db/schemas'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from '@lucide/vue'
import { ref } from 'vue'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import CategorySetCategoryPicker from './CategorySetCategoryPicker.vue'
import CategorySetMemberList from './CategorySetMemberList.vue'

const props = defineProps<{
  categorySet: CategorySet
  members: CategorySetMember[]
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const expanded = ref(false)
const pickerOpen = ref(false)
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center gap-3 space-y-0 p-4">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 text-left"
        @click="expanded = !expanded"
      >
        <ChevronDown
          v-if="expanded"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <ChevronUp
          v-else
          class="size-4 shrink-0 text-muted-foreground"
        />
        <span class="truncate font-semibold">{{ categorySet.name }}</span>
        <span class="shrink-0 text-sm text-muted-foreground">
          {{ members.length }} {{ members.length === 1 ? 'category' : 'categories' }}
        </span>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-8 shrink-0"
        @click="emit('edit')"
      >
        <Pencil class="size-4" />
      </Button>

      <AlertDialog>
        <AlertDialogTrigger as-child>
          <Button
            type="button" variant="ghost" size="icon" class="size-8 shrink-0"
          >
            <Trash2 class="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete set?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the "{{ categorySet.name }}" set and unlinks it from all playlists.
              Categories themselves are not deleted.
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
    </CardHeader>

    <CardContent v-if="expanded" class="px-4 pb-4">
      <CategorySetMemberList
        :set-id="props.categorySet.id"
        :members="members"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="mt-3 gap-2"
        @click="pickerOpen = true"
      >
        <Plus class="size-3" />
        Add categories
      </Button>
      <CategorySetCategoryPicker
        v-model:open="pickerOpen"
        :set-id="props.categorySet.id"
        :members="members"
      />
    </CardContent>
  </Card>
</template>
