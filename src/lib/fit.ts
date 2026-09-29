/** Demo fit math. Not a body scan and not a factory size chart. */

export const DEMO_SIZE_CHART = [
  { label: 'S', min: 86, max: 93 },
  { label: 'M', min: 94, max: 101 },
  { label: 'L', min: 102, max: 109 },
  { label: 'XL', min: 110, max: 122 },
] as const

export type FitWord = 'muat' | 'ketat' | 'longgar'

const REF_WEIGHT = 70
const REF_CHEST = 96

export function chestWidthScale(weightKg: number) {
  const scale = 1 + (weightKg - REF_WEIGHT) * 0.008
  return Math.min(1.5, Math.max(0.72, scale))
}

export function heightScale(heightCm: number) {
  return Math.min(1.25, Math.max(0.8, heightCm / 175))
}

/** Chest circumference estimate in cm. Follows chest/waist width, not height. */
export function estimatedChestCm(weightKg: number) {
  return Math.round(REF_CHEST * chestWidthScale(weightKg))
}

export function fitFor(size: string, chestCm: number): FitWord {
  const row = DEMO_SIZE_CHART.find((item) => item.label === size)
  if (!row) return 'muat'
  if (chestCm < row.min) return 'longgar'
  if (chestCm > row.max) return 'ketat'
  return 'muat'
}

export function fitGloss(fit: FitWord) {
  if (fit === 'muat') return 'fits'
  if (fit === 'ketat') return 'tight'
  return 'loose'
}
