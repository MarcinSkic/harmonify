<script setup lang="ts">
import type { OverlayField } from '@/db/schemas'
import { Plus, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNavidromeTagIndex } from '@/composables/useNavidromeTagIndex'
import { useOverlayFieldsStore } from '@/stores'

const open = defineModel<boolean>('open', { required: true })

const overlayFieldsStore = useOverlayFieldsStore()
const { tagNames, load: loadTagIndex } = useNavidromeTagIndex()

const newName = ref('')
const newType = ref<OverlayField['type']>('text')

watch(open, (isOpen) => {
  if (!isOpen)
    return
  newName.value = ''
  newType.value = 'text'
  loadTagIndex()
})

const navidromeTagNames = computed(() => new Set(tagNames.value))

// A warning, never a block: the overlay wins over the Navidrome tag of the same name when the
// field bag is merged, which is occasionally what the user wants.
const shadowsNavidromeTag = computed(() => navidromeTagNames.value.has(newName.value.trim()))

async function addField() {
  const name = newName.value.trim()
  if (!name) {
    toast.error('Field name is required')
    return
  }

  if (overlayFieldsStore.overlayFields.some(field => field.name === name)) {
    toast.error(`A field named "${name}" is already registered`)
    return
  }

  try {
    await overlayFieldsStore.upsert(name, newType.value)
    if (shadowsNavidromeTag.value)
      toast.warning(`Navidrome already has a tag named "${name}"; the overlay field will shadow it`)
    newName.value = ''
    newType.value = 'text'
  }
  catch (error) {
    toast.error(`Failed to save the field: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function changeType(field: OverlayField, type: OverlayField['type']) {
  try {
    await overlayFieldsStore.upsert(field.name, type)
  }
  catch (error) {
    toast.error(`Failed to save the field: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function removeField(name: string) {
  try {
    await overlayFieldsStore.remove(name)
  }
  catch (error) {
    toast.error(`Failed to remove the field: ${error instanceof Error ? error.message : String(error)}`)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Overlay fields</DialogTitle>
        <DialogDescription>
          Names and types of the extra fields a category can match on. Removing a field here only
          takes it out of the dictionary — values already set on tracks stay.
        </DialogDescription>
      </DialogHeader>

      <div class="grid max-h-80 gap-2 overflow-y-auto py-2">
        <p
          v-if="overlayFieldsStore.overlayFields.length === 0"
          class="py-2 text-center text-sm text-muted-foreground"
        >
          No fields registered yet.
        </p>

        <div
          v-for="field in overlayFieldsStore.overlayFields"
          :key="field.name"
          class="flex items-center gap-2"
        >
          <span class="min-w-0 flex-1 truncate text-sm">{{ field.name }}</span>
          <Select
            :model-value="field.type"
            @update:model-value="(v) => v && changeType(field, v as OverlayField['type'])"
          >
            <SelectTrigger class="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="text">
                  Text
                </SelectItem>
                <SelectItem value="number">
                  Number
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            @click="removeField(field.name)"
          >
            <X class="size-4" />
          </Button>
        </div>
      </div>

      <form class="grid gap-2 border-t pt-3" @submit.prevent="addField">
        <Label for="overlay-field-name">New field</Label>
        <div class="flex items-center gap-2">
          <Input
            id="overlay-field-name"
            v-model="newName"
            placeholder="e.g. popularity"
            class="flex-1"
            autocomplete="off"
          />
          <Select v-model:model-value="newType">
            <SelectTrigger class="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="text">
                  Text
                </SelectItem>
                <SelectItem value="number">
                  Number
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" size="icon" class="
            size-9 shrink-0
          "
          >
            <Plus class="size-4" />
          </Button>
        </div>
        <p v-if="shadowsNavidromeTag" class="text-xs text-muted-foreground">
          Navidrome already has a tag named "{{ newName.trim() }}"; the overlay field will shadow it.
        </p>
      </form>

      <DialogFooter>
        <Button type="button" variant="ghost" @click="open = false">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
