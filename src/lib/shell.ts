/** Four shells cut from the same CC0 body. Length is not a fifth mesh. */

export type Garment = 'short' | 'long' | 'button' | 'sleeveless'

export const GARMENT_OPTIONS: { id: Garment; label: string }[] = [
  { id: 'short', label: 'Short sleeve' },
  { id: 'long', label: 'Long sleeve' },
  { id: 'button', label: 'Button shirt' },
  { id: 'sleeveless', label: 'Sleeveless' },
]

export const LENGTH_MIN = 58
export const LENGTH_MAX = 84

export function clampLength(value: number) {
  if (!Number.isFinite(value)) return 70
  return Math.min(LENGTH_MAX, Math.max(LENGTH_MIN, Math.round(value)))
}

export function shellLabel(shell: Garment) {
  return GARMENT_OPTIONS.find((item) => item.id === shell)?.label ?? shell
}

export function isGarment(value: unknown): value is Garment {
  return value === 'short' || value === 'long' || value === 'button' || value === 'sleeveless'
}
