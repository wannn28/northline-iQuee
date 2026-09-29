/** Four shells cut from the same CC0 body. Length is not a fifth mesh. */

export type Garment = 'short' | 'long' | 'button' | 'sleeveless'

export const GARMENT_OPTIONS: { id: Garment; label: string }[] = [
  { id: 'short', label: 'Short sleeve' },
  { id: 'long', label: 'Long sleeve' },
  { id: 'button', label: 'Button shirt' },
  { id: 'sleeveless', label: 'Sleeveless' },
]

/** Collar-to-hem cm. 80 is the waist ring; 129 reaches the upper thigh on the same ruler. */
export const LENGTH_MIN = 80
export const LENGTH_MAX = 129

/** Chest width in cm. 48 is the unscaled shell. */
export const WIDTH_MIN = 36
export const WIDTH_MAX = 64
export const WIDTH_DEFAULT = 48

/** Neck and sleeve openings in cm. Defaults match the bound circles on the sleeveless shell. */
export const NECK_MIN = 12
export const NECK_MAX = 24
export const NECK_DEFAULT = 16
export const SLEEVE_MIN = 12
export const SLEEVE_MAX = 26
export const SLEEVE_DEFAULT = 18

/** Sleeve length along the arm, in cm. Sleeveless ignores it. */
export const SLEEVE_LEN_MIN = 8
export const SLEEVE_LEN_MAX = 62
export const SLEEVE_LEN_DEFAULT = 22
export const SLEEVE_LEN_LONG = 58

function clampCm(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function clampLength(value: number) {
  return clampCm(value, LENGTH_MIN, LENGTH_MAX, LENGTH_MIN)
}

export function clampWidth(value: number) {
  return clampCm(value, WIDTH_MIN, WIDTH_MAX, WIDTH_DEFAULT)
}

export function clampNeck(value: number) {
  return clampCm(value, NECK_MIN, NECK_MAX, NECK_DEFAULT)
}

export function clampSleeve(value: number) {
  return clampCm(value, SLEEVE_MIN, SLEEVE_MAX, SLEEVE_DEFAULT)
}

export function clampSleeveLength(value: number, fallback = SLEEVE_LEN_DEFAULT) {
  return clampCm(value, SLEEVE_LEN_MIN, SLEEVE_LEN_MAX, fallback)
}

export function defaultSleeveLength(shell: Garment) {
  return shell === 'long' || shell === 'button' ? SLEEVE_LEN_LONG : SLEEVE_LEN_DEFAULT
}

export type ShellFit = {
  widthScale: number
  neckScale: number
  sleeveScale: number
}

export function shellFit(bodyWidthCm: number, neckCm: number, sleeveCm: number): ShellFit {
  return {
    widthScale: clampWidth(bodyWidthCm) / WIDTH_DEFAULT,
    neckScale: clampNeck(neckCm) / NECK_DEFAULT,
    sleeveScale: clampSleeve(sleeveCm) / SLEEVE_DEFAULT,
  }
}

export function shellLabel(shell: Garment) {
  return GARMENT_OPTIONS.find((item) => item.id === shell)?.label ?? shell
}

export function isGarment(value: unknown): value is Garment {
  return value === 'short' || value === 'long' || value === 'button' || value === 'sleeveless'
}
