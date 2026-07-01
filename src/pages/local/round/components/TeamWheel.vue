<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, onUnmounted, ref } from 'vue'
import { computeTargetRotation, easeOutWheel, playWheelTick, truncateLabel, WHEEL_COLORS } from './wheel'

const props = defineProps<{
  participants: { id: string, name: string }[]
  winnerId: string | null
}>()

const emit = defineEmits<{
  spinStart: []
  spinEnd: [winnerId: string]
}>()

const SPIN_DURATION_MS = 4000
const CENTER = 50
const RADIUS = 48
const TEXT_RADIUS = 30

const rotation = ref(0)
const isSpinning = ref(false)
let rafId = 0

function pointOnCircle(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: CENTER + r * Math.sin(rad),
    y: CENTER - r * Math.cos(rad),
  }
}

const sectors = computed(() => {
  const n = props.participants.length
  if (n < 2)
    return []
  const sector = 360 / n
  return props.participants.map((team, i) => {
    const start = pointOnCircle(i * sector, RADIUS)
    const end = pointOnCircle((i + 1) * sector, RADIUS)
    const largeArc = sector > 180 ? 1 : 0
    const midAngle = (i + 0.5) * sector
    const label = pointOnCircle(midAngle, TEXT_RADIUS)
    // Radial orientation; flip labels on the left half so they stay upright.
    const flip = midAngle > 90 && midAngle < 270
    const labelRot = flip ? midAngle + 90 : midAngle - 90
    return {
      id: team.id,
      name: truncateLabel(team.name),
      color: WHEEL_COLORS[i % WHEEL_COLORS.length],
      d: `M${CENTER},${CENTER} L${start.x},${start.y} A${RADIUS},${RADIUS} 0 ${largeArc},1 ${end.x},${end.y} Z`,
      labelX: label.x,
      labelY: label.y,
      labelRot,
    }
  })
})

const rotatingStyle = computed<CSSProperties>(() => ({
  transformBox: 'fill-box',
  transformOrigin: 'center',
  transform: `rotate(${rotation.value}deg)`,
}))

function spin() {
  const n = props.participants.length
  if (n < 2 || isSpinning.value)
    return

  const winnerIndex = Math.floor(Math.random() * n)
  const winnerId = props.participants[winnerIndex].id
  const from = rotation.value
  const to = computeTargetRotation(from, winnerIndex, n)
  const sectorAngle = 360 / n
  let lastBoundary = Math.floor(from / sectorAngle)

  isSpinning.value = true
  emit('spinStart')

  const start = performance.now()

  function frame(now: number) {
    const progress = Math.min((now - start) / SPIN_DURATION_MS, 1)
    rotation.value = from + (to - from) * easeOutWheel(progress)

    // Tick whenever a sector boundary passes under the pointer (at most once
    // per frame, so the rattle naturally slows as the wheel decelerates).
    const boundary = Math.floor(rotation.value / sectorAngle)
    if (boundary !== lastBoundary) {
      lastBoundary = boundary
      playWheelTick()
    }

    if (progress < 1) {
      rafId = requestAnimationFrame(frame)
      return
    }

    rotation.value = to
    isSpinning.value = false
    rafId = 0
    emit('spinEnd', winnerId)
  }

  rafId = requestAnimationFrame(frame)
}

onUnmounted(() => {
  if (rafId)
    cancelAnimationFrame(rafId)
})

defineExpose({ spin })
</script>

<template>
  <div class="relative aspect-square w-full">
    <!-- Pointer -->
    <svg
      class="absolute inset-x-0 top-0 z-10 mx-auto"
      width="28"
      height="20"
      viewBox="0 0 28 20"
      aria-hidden="true"
    >
      <path d="M2,0 L26,0 L14,18 Z" class="fill-foreground" />
    </svg>

    <svg viewBox="0 0 100 100" class="size-full">
      <g :style="rotatingStyle">
        <template v-if="sectors.length">
          <path
            v-for="sector in sectors"
            :key="sector.id"
            :d="sector.d"
            :fill="sector.color"
            stroke="#0b1220"
            stroke-width="0.5"
            class="transition-opacity"
            :class="winnerId && sector.id !== winnerId ? 'opacity-30' : `
              opacity-100
            `"
          />
          <text
            v-for="sector in sectors"
            :key="`t-${sector.id}`"
            :x="sector.labelX"
            :y="sector.labelY"
            :transform="`rotate(${sector.labelRot} ${sector.labelX} ${sector.labelY})`"
            text-anchor="middle"
            dominant-baseline="central"
            fill="#ffffff"
            font-size="4.5"
            font-weight="600"
            class="pointer-events-none select-none"
            :class="winnerId && sector.id !== winnerId ? 'opacity-40' : `
              opacity-100
            `"
          >
            {{ sector.name }}
          </text>
        </template>
        <circle
          v-else
          :cx="CENTER"
          :cy="CENTER"
          :r="RADIUS"
          class="fill-muted"
          stroke="#0b1220"
          stroke-width="0.5"
        />
      </g>
      <!-- Hub -->
      <circle :cx="CENTER" :cy="CENTER" r="4" class="fill-background" stroke="#0b1220" stroke-width="0.5" />
    </svg>
  </div>
</template>
