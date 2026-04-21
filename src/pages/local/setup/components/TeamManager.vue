<script setup lang="ts">
import { Plus, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const teams = defineModel<{ name: string }[]>({ required: true })

function addTeam() {
  teams.value.push({ name: '' })
}

function removeTeam(index: number) {
  if (teams.value.length <= 1)
    return
  teams.value.splice(index, 1)
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 rounded-lg border px-5 py-4">
    <h2
      class="
        text-center text-xl font-bold
        lg:text-3xl
      "
    >
      Teams
    </h2>
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="(team, index) in teams"
        :key="index"
        class="flex items-center gap-1"
      >
        <Input
          v-model="team.name"
          :placeholder="`Team ${index + 1}`"
          class="flex-1"
        />
        <Button
          v-if="teams.length > 1"
          variant="ghost"
          size="icon"
          type="button"
          class="size-9 shrink-0"
          @click="removeTeam(index)"
        >
          <X class="size-4" />
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        type="button"
        class="h-9 gap-1"
        @click="addTeam"
      >
        <Plus class="size-4" />
        Add team
      </Button>
    </div>
  </div>
</template>
