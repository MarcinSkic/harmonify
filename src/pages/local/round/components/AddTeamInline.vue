<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const emit = defineEmits<{ add: [name: string] }>()

const isAdding = ref(false)
const newTeamName = ref('')

function handleAdd() {
  emit('add', newTeamName.value)
  newTeamName.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    isAdding.value = false
    newTeamName.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <template v-if="!isAdding">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="gap-1 text-muted-foreground"
        @click="isAdding = true"
      >
        <Plus class="size-4" />
        Add team
      </Button>
    </template>
    <template v-else>
      <div class="flex items-center gap-2">
        <Input
          v-model="newTeamName"
          placeholder="Team name"
          class="w-40"
          autofocus
          @keydown="handleKeydown"
          @keydown.enter="handleAdd"
        />
        <Button type="button" size="sm" @click="handleAdd">
          Add
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          @click="isAdding = false; newTeamName = ''"
        >
          Cancel
        </Button>
      </div>
    </template>
  </div>
</template>
