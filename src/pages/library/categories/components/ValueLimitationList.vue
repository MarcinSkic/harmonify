<script setup lang="ts">
import type { FieldLimitation, OtherValueLimit } from '@/db/schemas'
import { Pencil, X } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCategorySetsStore } from '@/stores'

const props = defineProps<{
  setId: string
  limitations: FieldLimitation[]
}>()

const emit = defineEmits<{
  edit: [limitation: FieldLimitation]
}>()

const categorySetsStore = useCategorySetsStore()

function pairExceptionCount(pairs: OtherValueLimit[]): number {
  return pairs.reduce((sum, pair) => sum + (pair.exceptions?.length ?? 0), 0)
}

/**
 * Every `exceptions` array reachable from this entry: its own, its `otherValuesLimit[]` pairs', and
 * the pairs nested one level deeper inside its own per-value overrides. The badge has to warn that
 * none of them apply, wherever in the entry they are declared.
 */
function totalExceptions(limitation: FieldLimitation): number {
  const own = limitation.exceptions ?? []
  const nestedPairs = own.flatMap(exception => exception.otherValuesLimit ?? [])
  return own.length
    + pairExceptionCount(limitation.otherValuesLimit ?? [])
    + pairExceptionCount(nestedPairs)
}

async function remove(name: string) {
  const next = props.limitations.filter(l => l.name !== name)
  await categorySetsStore.setValueLimitations(props.setId, next)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-if="limitations.length === 0"
      class="py-3 text-center text-sm text-muted-foreground"
    >
      No value limits in this set.
    </div>
    <div
      v-for="limitation in limitations"
      :key="limitation.name"
      class="
        flex items-start gap-2 rounded-md px-2 py-1.5
        hover:bg-muted/50
      "
    >
      <div class="min-w-0 flex-1 text-sm">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="font-medium">{{ limitation.name }}</span>
          <span v-if="limitation.selfLimit !== undefined" class="
            text-muted-foreground
          "
          >
            — self max {{ limitation.selfLimit }}
          </span>
          <Badge v-if="limitation.multiValue === 'first'" variant="outline">
            multiValue: first
          </Badge>
          <Badge v-if="totalExceptions(limitation) > 0" variant="destructive">
            {{ totalExceptions(limitation) }} exceptions (not applied)
          </Badge>
        </div>
        <div
          v-for="(pair, pairIndex) in limitation.otherValuesLimit ?? []"
          :key="pairIndex"
          class="
            mt-0.5 flex flex-wrap items-center gap-1.5 text-xs
            text-muted-foreground
          "
        >
          <span>└ {{ pair.name }} max {{ pair.limit }}</span>
          <Badge v-if="pair.multiValue === 'first'" variant="outline">
            multiValue: first
          </Badge>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-7 shrink-0"
        @click="emit('edit', limitation)"
      >
        <Pencil class="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-7 shrink-0"
        @click="remove(limitation.name)"
      >
        <X class="size-3" />
      </Button>
    </div>
  </div>
</template>
