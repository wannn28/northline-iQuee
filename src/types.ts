export type Variant = {
  id: number
  label: string
  price_cents: number
  sku: string
}

export type Product = {
  id: number
  handle: string
  title: string
  kind: 'poster' | 'tee'
  description: string
  details: string
  price_cents: number
  variants: Variant[]
}

export type OrderItem = {
  product_title: string
  product_handle: string
  variant_label: string
  sku: string
  qty: number
  unit_cents: number
}

export type Order = {
  public_id: string
  email: string
  ship_name: string
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  subtotal_cents: number
  shipping_cents: number
  total_cents: number
  card_brand: string
  card_last4: string
  created_at: string
  items: OrderItem[]
}

export function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function priceLabel(product: Product) {
  const prices = product.variants.map((variant) => variant.price_cents)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? money(min) : `From ${money(min)}`
}
