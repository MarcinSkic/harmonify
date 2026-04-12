<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  availableTags: string[]
}>()

const modelValue = defineModel<string[]>({ required: true })

const query = ref('')
const isFocused = ref(false)

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  const selected = new Set(modelValue.value)
  return props.availableTags
    .filter(tag => !selected.has(tag))
    .filter(tag => q === '' || tag.toLowerCase().includes(q))
    .slice(0, 50)
})

function addTag(tag: string) {
  if (!modelValue.value.includes(tag))
    modelValue.value = [...modelValue.value, tag]
  query.value = ''
}

function removeTag(tag: string) {
  modelValue.value = modelValue.value.filter(t => t !== tag)
}

function handleFocus() {
  isFocused.value = true
}

function handleBlur() {
  // Delay to allow click on suggestion to register.
  setTimeout(() => {
    isFocused.value = false
  }, 150)
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="modelValue.length > 0"
      class="flex flex-wrap gap-1.5"
    >
      <Badge
        v-for="tag in modelValue"
        :key="tag"
        variant="secondary"
        class="gap-1 pr-1"
      >
        {{ tag }}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="
            size-4
            hover:bg-transparent
          "
          @click="removeTag(tag)"
        >
          <X class="size-3" />
        </Button>
      </Badge>
    </div>

    <div class="relative">
      <Input
        v-model="query"
        :placeholder="availableTags.length === 0
          ? 'No tags in library — add tags to your tracks first'
          : 'Search tags...'"
        :disabled="availableTags.length === 0"
        @focus="handleFocus"
        @blur="handleBlur"
      />

      <div
        v-if="isFocused && suggestions.length > 0"
        class="
          absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border
          bg-popover shadow-md
        "
      >
        <button
          v-for="tag in suggestions"
          :key="tag"
          type="button"
          class="
            flex w-full items-center px-3 py-2 text-left text-sm
            hover:bg-accent
          "
          @mousedown.prevent="addTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>
  </div>
</template>
