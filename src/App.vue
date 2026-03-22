<script setup lang="ts">
import 'vue-sonner/style.css'
import { Toaster } from '@/components/ui/sonner'
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
  <Toaster />
</template>
