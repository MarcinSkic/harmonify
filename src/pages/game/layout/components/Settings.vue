<script setup lang="ts">
import { Settings } from '@lucide/vue'
import SettingsSheet from '@/components/SettingsSheet.vue'
import { Button } from '@/components/ui/button'
</script>

<template>
  <SettingsSheet as-child>
    <Button variant="ghost" size="icon">
      <Settings />
    </Button>
  </SettingsSheet>
</template>
