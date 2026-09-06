<script setup lang="ts">
import { computed, ref } from 'vue'
import { Input } from '@/components/ui/input'

const props = withDefaults(defineProps<{
  suggestions: string[]
  placeholder?: string
  disabled?: boolean
  /** Cap on rendered suggestions — a Navidrome tag can have thousands of distinct values. */
  limit?: number
}>(), {
  limit: 50,
})

/** Blur does not bubble, so it is re-emitted for callers that reconcile once the value settles. */
const emit = defineEmits<{
  blur: []
}>()

const modelValue = defineModel<string>({ required: true })

const isFocused = ref(false)

// Free text stays valid: the list narrows what is already typed instead of constraining it.
const matches = computed(() => {
  const query = modelValue.value.trim().toLowerCase()
  return props.suggestions
    .filter(suggestion => query === '' || suggestion.toLowerCase().includes(query))
    .filter(suggestion => suggestion !== modelValue.value)
    .slice(0, props.limit)
})

function handleBlur() {
  // Delay to allow a click on a suggestion to register.
  setTimeout(() => {
    isFocused.value = false
  }, 150)
  emit('blur')
}
</script>

<template>
  <div class="relative">
    <Input
      v-model="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      @focus="isFocused = true"
      @blur="handleBlur"
    />

    <div
      v-if="isFocused && matches.length > 0"
      class="
        absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border
        bg-popover shadow-md
      "
    >
      <button
        v-for="suggestion in matches"
        :key="suggestion"
        type="button"
        class="
          flex w-full items-center px-3 py-2 text-left text-sm
          hover:bg-accent
        "
        @mousedown.prevent="modelValue = suggestion"
      >
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>
