<script setup lang="ts">
import type { CategorySet } from '@/db/schemas'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCategorySetsStore } from '@/stores'

const props = defineProps<{
  categorySet: CategorySet | null
}>()

const open = defineModel<boolean>('open', { required: true })

const categorySetsStore = useCategorySetsStore()
const name = ref('')

watch(
  () => [open.value, props.categorySet] as const,
  ([isOpen, set]) => {
    if (!isOpen)
      return
    name.value = set?.name ?? ''
  },
  { immediate: true },
)

async function handleSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    toast.error('Name is required')
    return
  }

  try {
    if (props.categorySet)
      await categorySetsStore.update(props.categorySet.id, trimmed)
    else
      await categorySetsStore.create(trimmed)
    open.value = false
  }
  catch (err) {
    toast.error(`Failed to save set: ${(err as Error).message}`)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ categorySet ? 'Rename set' : 'New category set' }}</DialogTitle>
      </DialogHeader>

      <form class="grid gap-4 py-2" @submit.prevent="handleSubmit">
        <div class="grid gap-2">
          <Label for="set-name">Name</Label>
          <Input
            id="set-name"
            v-model="name"
            placeholder="e.g. Anime Quizy"
            autocomplete="off"
          />
        </div>
      </form>

      <DialogFooter>
        <Button type="button" variant="ghost" @click="open = false">
          Cancel
        </Button>
        <Button type="button" @click="handleSubmit">
          {{ categorySet ? 'Save' : 'Create' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
