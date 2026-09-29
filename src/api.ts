import type { Order, Product } from './types'

async function read<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    const message = data.error || 'Something went wrong. Try again.'
    const error = new Error(message) as Error & { status: number }
    error.status = res.status
    throw error
  }
  return data
}

export async function fetchProducts() {
  const data = await read<{ products: Product[] }>(await fetch('/api/products'))
  return data.products
}

export async function fetchProduct(handle: string) {
  const data = await read<{ product: Product }>(await fetch(`/api/products/${handle}`))
  return data.product
}

export async function checkout(body: unknown) {
  return read<{ demo: boolean; charged: boolean; message: string; order: Order }>(
    await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

export async function fetchOrder(publicId: string) {
  const data = await read<{ order: Order }>(await fetch(`/api/orders/${publicId}`))
  return data.order
}

export async function adminLogin(password: string) {
  await read(await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }))
}

export async function adminLogout() {
  await read(await fetch('/api/admin/logout', { method: 'POST' }))
}

export async function fetchAdminOrders() {
  const data = await read<{ orders: Order[] }>(await fetch('/api/admin/orders'))
  return data.orders
}
