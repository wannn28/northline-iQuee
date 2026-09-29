export const TEE_COLORS = [
  { id: 'charcoal', label: 'Charcoal', hex: '#2c3338' },
  { id: 'olive', label: 'Olive', hex: '#5d6243' },
  { id: 'navy', label: 'Navy', hex: '#1c2b44' },
  { id: 'sand', label: 'Sand', hex: '#d8c6a4' },
] as const

const DEFAULT_TEE_COLOR: Record<string, string> = {
  'northline-heavyweight-tee': '#2c3338',
  'field-mark-tee': '#5d6243',
  'dockside-tee': '#1c2b44',
  'low-tide-tee': '#d8c6a4',
}

export function defaultTeeColor(handle: string) {
  return DEFAULT_TEE_COLOR[handle] ?? TEE_COLORS[0].hex
}
