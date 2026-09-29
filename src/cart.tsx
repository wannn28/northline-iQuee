import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { FitWord } from './lib/fit'
import { isGarment, type Garment } from './lib/shell'

export type CartLine = {
  variantId: number
  handle: string
  title: string
  label: string
  unitCents: number
  qty: number
  sellerProductId?: string
  sellerName?: string
  shell?: Garment
  lengthCm?: number
  frontImage?: string | null
  backImage?: string | null
  fit?: FitWord
}

export function lineKey(line: { variantId: number; sellerProductId?: string }) {
  return line.sellerProductId ? `${line.sellerProductId}:${line.variantId}` : `shop:${line.variantId}`
}

type CartApi = {
  lines: CartLine[]
  count: number
  subtotal: number
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

const KEY = 'northline-cart'
const CartContext = createContext<CartApi | null>(null)

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartLine[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((line) => line && Number.isInteger(line.variantId) && line.qty > 0)
      .map((line) => ({
        ...line,
        shell: isGarment(line.shell) ? line.shell : undefined,
        sellerProductId: typeof line.sellerProductId === 'string' ? line.sellerProductId : undefined,
        sellerName: typeof line.sellerName === 'string' ? line.sellerName : undefined,
        lengthCm: Number.isFinite(Number(line.lengthCm)) ? Number(line.lengthCm) : undefined,
        frontImage: typeof line.frontImage === 'string' ? line.frontImage : null,
        backImage: typeof line.backImage === 'string' ? line.backImage : null,
        fit: line.fit === 'muat' || line.fit === 'ketat' || line.fit === 'longgar' ? line.fit : undefined,
      }))
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => (typeof localStorage === 'undefined' ? [] : load()))

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(lines))
  }, [lines])

  const api = useMemo<CartApi>(() => {
    const count = lines.reduce((sum, line) => sum + line.qty, 0)
    const subtotal = lines.reduce((sum, line) => sum + line.unitCents * line.qty, 0)
    return {
      lines,
      count,
      subtotal,
      add: (line, qty = 1) => {
        setLines((current) => {
          const next = current.slice()
          const key = lineKey(line)
          const found = next.find((item) => lineKey(item) === key)
          if (found) found.qty = Math.min(9, found.qty + qty)
          else next.push({ ...line, qty: Math.min(9, qty) })
          return next
        })
      },
      setQty: (key, qty) => {
        setLines((current) =>
          current
            .map((line) => (lineKey(line) === key ? { ...line, qty } : line))
            .filter((line) => line.qty > 0)
        )
      },
      remove: (key) => setLines((current) => current.filter((line) => lineKey(line) !== key)),
      clear: () => setLines([]),
    }
  }, [lines])

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}

export function shippingCents(subtotal: number) {
  return subtotal >= 7500 ? 0 : subtotal === 0 ? 0 : 650
}
