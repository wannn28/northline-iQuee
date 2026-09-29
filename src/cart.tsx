import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type CartLine = {
  variantId: number
  handle: string
  title: string
  label: string
  unitCents: number
  qty: number
}

type CartApi = {
  lines: CartLine[]
  count: number
  subtotal: number
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => void
  setQty: (variantId: number, qty: number) => void
  remove: (variantId: number) => void
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
    return parsed.filter((line) => line && Number.isInteger(line.variantId) && line.qty > 0)
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
          const found = next.find((item) => item.variantId === line.variantId)
          if (found) found.qty = Math.min(9, found.qty + qty)
          else next.push({ ...line, qty: Math.min(9, qty) })
          return next
        })
      },
      setQty: (variantId, qty) => {
        setLines((current) =>
          current
            .map((line) => (line.variantId === variantId ? { ...line, qty } : line))
            .filter((line) => line.qty > 0)
        )
      },
      remove: (variantId) => setLines((current) => current.filter((line) => line.variantId !== variantId)),
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
