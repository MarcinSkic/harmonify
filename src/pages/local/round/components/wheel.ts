// Pure helpers for the take-over wheel of fortune.
// Angles are measured in degrees, clockwise from the top (12 o'clock),
// which matches CSS `transform: rotate()` in screen coordinates. The
// pointer sits at the top, i.e. screen angle 0.

/** Sector colors cycled by index (teams have no color in the schema). */
export const WHEEL_COLORS = [
  '#1b3162',
  '#b91c1c',
  '#15803d',
  '#a16207',
  '#6d28d9',
  '#0e7490',
  '#be185d',
  '#c2410c',
] as const

export const WHEEL_SPINS = 5

/**
 * Compute the absolute rotation (degrees) the wheel must animate to so that
 * the center of `winnerIndex`'s sector ends up under the top pointer.
 *
 * The result is always greater than `currentRotation` (spins forward) and
 * includes at least `spins` full turns for effect.
 */
export function computeTargetRotation(
  currentRotation: number,
  winnerIndex: number,
  n: number,
  spins: number = WHEEL_SPINS,
): number {
  const sector = 360 / n
  const midAngle = (winnerIndex + 0.5) * sector
  // Rotation R such that (midAngle + R) ≡ 0 (mod 360).
  const base = (((-midAngle) % 360) + 360) % 360
  const delta = ((base - (currentRotation % 360)) + 360) % 360
  return currentRotation + spins * 360 + delta
}

/** Truncate a label to `max` chars, appending an ellipsis like the CSS `truncate` util. */
export function truncateLabel(name: string, max: number = 12): string {
  if (name.length <= max)
    return name
  return `${name.slice(0, max)}…`
}

/** Ease-out used while the wheel decelerates — quartic gives a nice slow finish. */
export function easeOutWheel(p: number): number {
  return 1 - (1 - p) ** 4
}

let audioCtx: (AudioContext | null) = null
let noiseBuffer: AudioBuffer | null = null

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer)
    return noiseBuffer
  const length = Math.floor(ctx.sampleRate * 0.03)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++)
    data[i] = Math.random() * 2 - 1
  noiseBuffer = buffer
  return buffer
}

/** Play a delicate click, like a light snap, as a sector passes the pointer. */
export function playWheelTick() {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined')
    return
  audioCtx ??= new AudioContext()
  if (audioCtx.state === 'suspended')
    void audioCtx.resume()

  const now = audioCtx.currentTime
  const src = audioCtx.createBufferSource()
  src.buffer = getNoiseBuffer(audioCtx)

  // Band-pass the noise burst so it reads as a crisp, soft "click" rather than a hiss.
  const filter = audioCtx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2600
  filter.Q.value = 1.2

  const gain = audioCtx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.0008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015)

  src.connect(filter).connect(gain).connect(audioCtx.destination)
  src.start(now)
  src.stop(now + 0.03)
}
