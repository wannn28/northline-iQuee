import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clampLength, clampNeck, clampSleeve, clampSleeveLength, clampWidth, defaultSleeveLength, isGarment, type Garment } from './lib/shell'

export type SellerProduct = {
  id: string
  name: string
  shell: Garment
  lengthCm: number
  bodyWidthCm: number
  neckCm: number
  sleeveCm: number
  sleeveLengthCm: number
  frontImage: string | null
  backImage: string | null
}

type SellerApi = {
  products: SellerProduct[]
  addProduct: (input: Omit<SellerProduct, 'id'>) => string | null
  removeProduct: (id: string) => void
}

const KEY = 'northline-seller-products-v1'
const SellerContext = createContext<SellerApi | null>(null)

function load(): SellerProduct[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SellerProduct[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && isGarment(item.shell))
      .map((item) => ({
        id: item.id,
        name: item.name.slice(0, 60),
        shell: item.shell,
        lengthCm: clampLength(Number(item.lengthCm)),
        bodyWidthCm: clampWidth(Number(item.bodyWidthCm)),
        neckCm: clampNeck(Number(item.neckCm)),
        sleeveCm: clampSleeve(Number(item.sleeveCm)),
        sleeveLengthCm: clampSleeveLength(Number(item.sleeveLengthCm), defaultSleeveLength(item.shell)),
        frontImage: typeof item.frontImage === 'string' ? item.frontImage : null,
        backImage: typeof item.backImage === 'string' ? item.backImage : null,
      }))
  } catch {
    return []
  }
}

export function SellerProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<SellerProduct[]>(() => (typeof localStorage === 'undefined' ? [] : load()))

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(products))
  }, [products])

  const api = useMemo<SellerApi>(
    () => ({
      products,
      addProduct(input) {
        const name = input.name.trim()
        if (!name) return 'Name the product.'
        if (!isGarment(input.shell)) return 'Choose a shell.'
        const product: SellerProduct = {
          id: crypto.randomUUID(),
          name: name.slice(0, 60),
          shell: input.shell,
          lengthCm: clampLength(input.lengthCm),
          bodyWidthCm: clampWidth(input.bodyWidthCm),
          neckCm: clampNeck(input.neckCm),
          sleeveCm: clampSleeve(input.sleeveCm),
          sleeveLengthCm: clampSleeveLength(input.sleeveLengthCm),
          frontImage: input.frontImage,
          backImage: input.backImage,
        }
        setProducts((current) => [product, ...current])
        return null
      },
      removeProduct(id) {
        setProducts((current) => current.filter((item) => item.id !== id))
      },
    }),
    [products],
  )

  return <SellerContext.Provider value={api}>{children}</SellerContext.Provider>
}

export function useSeller() {
  const ctx = useContext(SellerContext)
  if (!ctx) throw new Error('useSeller must be used inside SellerProvider')
  return ctx
}
