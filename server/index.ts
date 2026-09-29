import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cookieParser from 'cookie-parser'
import Database from 'better-sqlite3'

const ROOT = process.cwd()
const PORT = Number(process.env.PORT || 3018)
const HOST = process.env.HOST || '127.0.0.1'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'northline-demo'
const DATA_DIR = path.join(ROOT, 'data')
const DB_PATH = path.join(DATA_DIR, 'northline.db')
const DIST = path.join(ROOT, 'dist')

type Kind = 'poster' | 'tee'

type SeedVariant = { label: string; price_cents: number; sku: string }
type SeedProduct = {
  handle: string
  title: string
  kind: Kind
  description: string
  details: string
  variants: SeedVariant[]
}

const CATALOG: SeedProduct[] = [
  {
    handle: 'harbor-line-no-4',
    title: 'Harbor Line No. 4',
    kind: 'poster',
    description:
      'A working waterfront reduced to two fields and a single brass line. Quiet enough for a hallway, large enough for a studio wall.',
    details: 'Archival matte, 200 gsm. Printed to order in the US. Frame not included.',
    variants: [
      { label: '12×18 in', price_cents: 3600, sku: 'HL04-1218' },
      { label: '18×24 in', price_cents: 4800, sku: 'HL04-1824' },
      { label: '24×36 in', price_cents: 6800, sku: 'HL04-2436' },
    ],
  },
  {
    handle: 'northline-heavyweight-tee',
    title: 'Northline Heavyweight Tee',
    kind: 'tee',
    description:
      'Charcoal 7.5 oz cotton with a small chest mark. Boxy unisex fit, printed after you order — not pulled from a shelf of leftovers.',
    details: '7.5 oz heavyweight cotton. Pre-shrunk. Printed to order in the US.',
    variants: [
      { label: 'S', price_cents: 4800, sku: 'NL-TEE-S' },
      { label: 'M', price_cents: 4800, sku: 'NL-TEE-M' },
      { label: 'L', price_cents: 4800, sku: 'NL-TEE-L' },
      { label: 'XL', price_cents: 4800, sku: 'NL-TEE-XL' },
    ],
  },
  {
    handle: 'cascade-study',
    title: 'Cascade Study',
    kind: 'poster',
    description:
      'Stacked bands of ink, moss, stone, and cedar. A print for rooms that already have enough pictures of mountains.',
    details: 'Archival matte, 200 gsm. Printed to order in the US. Frame not included.',
    variants: [
      { label: '12×18 in', price_cents: 3200, sku: 'CS-1218' },
      { label: '18×24 in', price_cents: 4400, sku: 'CS-1824' },
      { label: '24×36 in', price_cents: 6200, sku: 'CS-2436' },
    ],
  },
  {
    handle: 'field-mark-tee',
    title: 'Field Mark Tee',
    kind: 'tee',
    description:
      'Olive heavyweight tee with a two-word chest print. Same blank as the rest of the line: thick cotton, short sleeves, no fashion cut.',
    details: '7.5 oz heavyweight cotton. Pre-shrunk. Printed to order in the US.',
    variants: [
      { label: 'S', price_cents: 4600, sku: 'FM-TEE-S' },
      { label: 'M', price_cents: 4600, sku: 'FM-TEE-M' },
      { label: 'L', price_cents: 4600, sku: 'FM-TEE-L' },
      { label: 'XL', price_cents: 4600, sku: 'FM-TEE-XL' },
    ],
  },
  {
    handle: 'night-ferry',
    title: 'Night Ferry',
    kind: 'poster',
    description:
      'A pale disc over midnight blue, and almost nothing else. The smallest size still holds a wall beside a desk.',
    details: 'Archival matte, 200 gsm. Printed to order in the US. Frame not included.',
    variants: [
      { label: '12×18 in', price_cents: 3400, sku: 'NF-1218' },
      { label: '18×24 in', price_cents: 4600, sku: 'NF-1824' },
      { label: '24×36 in', price_cents: 6400, sku: 'NF-2436' },
    ],
  },
  {
    handle: 'dockside-tee',
    title: 'Dockside Tee',
    kind: 'tee',
    description:
      'Navy heavyweight with a dock number on the chest. Built like a work shirt, sold as a graphic tee.',
    details: '7.5 oz heavyweight cotton. Pre-shrunk. Printed to order in the US.',
    variants: [
      { label: 'S', price_cents: 4400, sku: 'DK-TEE-S' },
      { label: 'M', price_cents: 4400, sku: 'DK-TEE-M' },
      { label: 'L', price_cents: 4400, sku: 'DK-TEE-L' },
      { label: 'XL', price_cents: 4400, sku: 'DK-TEE-XL' },
    ],
  },
  {
    handle: 'cedar-grid',
    title: 'Cedar Grid',
    kind: 'poster',
    description:
      'A measured pencil grid with one cedar square off-center. Printed edge to edge on warm paper.',
    details: 'Archival matte, 200 gsm. Printed to order in the US. Frame not included.',
    variants: [
      { label: '12×18 in', price_cents: 3000, sku: 'CG-1218' },
      { label: '18×24 in', price_cents: 4200, sku: 'CG-1824' },
      { label: '24×36 in', price_cents: 5800, sku: 'CG-2436' },
    ],
  },
  {
    handle: 'low-tide-tee',
    title: 'Low Tide Tee',
    kind: 'tee',
    description:
      'Sand-colored heavyweight tee, marked with a small tide line. The quietest shirt in the shop.',
    details: '7.5 oz heavyweight cotton. Pre-shrunk. Printed to order in the US.',
    variants: [
      { label: 'S', price_cents: 4200, sku: 'LT-TEE-S' },
      { label: 'M', price_cents: 4200, sku: 'LT-TEE-M' },
      { label: 'L', price_cents: 4200, sku: 'LT-TEE-L' },
      { label: 'XL', price_cents: 4200, sku: 'LT-TEE-XL' },
    ],
  },
]

fs.mkdirSync(DATA_DIR, { recursive: true })
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    handle TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    description TEXT NOT NULL,
    details TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS variants (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    label TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    sku TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    public_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    ship_name TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    subtotal_cents INTEGER NOT NULL,
    shipping_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    card_brand TEXT NOT NULL,
    card_last4 TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_title TEXT NOT NULL,
    product_handle TEXT NOT NULL,
    variant_label TEXT NOT NULL,
    sku TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_cents INTEGER NOT NULL
  );
`)

const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }
if (productCount.c === 0) {
  const insertProduct = db.prepare(
    `INSERT INTO products (handle, title, kind, description, details, sort_order)
     VALUES (@handle, @title, @kind, @description, @details, @sort_order)`
  )
  const insertVariant = db.prepare(
    `INSERT INTO variants (product_id, label, price_cents, sku)
     VALUES (@product_id, @label, @price_cents, @sku)`
  )
  const seed = db.transaction(() => {
    CATALOG.forEach((product, index) => {
      const info = insertProduct.run({
        handle: product.handle,
        title: product.title,
        kind: product.kind,
        description: product.description,
        details: product.details,
        sort_order: index,
      })
      for (const variant of product.variants) {
        insertVariant.run({
          product_id: info.lastInsertRowid,
          label: variant.label,
          price_cents: variant.price_cents,
          sku: variant.sku,
        })
      }
    })
  })
  seed()
}

type ProductRow = {
  id: number
  handle: string
  title: string
  kind: Kind
  description: string
  details: string
  sort_order: number
}
type VariantRow = {
  id: number
  product_id: number
  label: string
  price_cents: number
  sku: string
}

function listProducts() {
  const products = db.prepare('SELECT * FROM products ORDER BY sort_order').all() as ProductRow[]
  const variants = db.prepare('SELECT * FROM variants ORDER BY id').all() as VariantRow[]
  return products.map((product) => ({
    ...product,
    price_cents: Math.min(...variants.filter((v) => v.product_id === product.id).map((v) => v.price_cents)),
    variants: variants
      .filter((v) => v.product_id === product.id)
      .map(({ id, label, price_cents, sku }) => ({ id, label, price_cents, sku })),
  }))
}

function shippingCents(subtotal: number) {
  return subtotal >= 7500 ? 0 : 650
}

const STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD',
  'TN','TX','UT','VT','VA','WA','WV','WI','WY',
])

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function shaEqual(a: string, b: string) {
  const left = crypto.createHash('sha256').update(a).digest()
  const right = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(left, right)
}

function adminToken() {
  return crypto.createHmac('sha256', ADMIN_PASSWORD).update('northline-admin-v1').digest('hex')
}

function isAdmin(req: express.Request) {
  const cookie = String(req.cookies?.nl_admin || '')
  if (!cookie) return false
  return shaEqual(cookie, adminToken())
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sign in to view orders.' })
  next()
}

type OrderItemOut = {
  product_title: string
  product_handle: string
  variant_label: string
  sku: string
  qty: number
  unit_cents: number
}

function publicOrder(id: number) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!order) return null
  const items = db
    .prepare(
      `SELECT product_title, product_handle, variant_label, sku, qty, unit_cents
       FROM order_items WHERE order_id = ? ORDER BY id`
    )
    .all(id) as OrderItemOut[]
  return { ...order, items }
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '200kb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, shop: 'northline-supply', demo: true })
})

app.get('/api/products', (_req, res) => {
  res.json({ products: listProducts() })
})

app.get('/api/products/:handle', (req, res) => {
  const product = listProducts().find((item) => item.handle === req.params.handle)
  if (!product) return res.status(404).json({ error: 'Product not found.' })
  res.json({ product })
})

app.post('/api/checkout', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const ship = req.body?.shipping || {}
  const card = req.body?.card || {}
  const name = String(ship.name || '').trim()
  const line1 = String(ship.line1 || '').trim()
  const line2 = String(ship.line2 || '').trim()
  const city = String(ship.city || '').trim()
  const state = String(ship.state || '').trim().toUpperCase()
  const zip = String(ship.zip || '').trim()
  const cardName = String(card.name || '').trim()
  const cardNumber = String(card.number || '').replace(/\D/g, '')
  const exp = String(card.exp || '').trim()
  const cvc = String(card.cvc || '').replace(/\D/g, '')
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : []

  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email.' })
  if (name.length < 2) return res.status(400).json({ error: 'Enter the recipient name.' })
  if (line1.length < 4) return res.status(400).json({ error: 'Enter a street address.' })
  if (city.length < 2) return res.status(400).json({ error: 'Enter a city.' })
  if (!STATES.has(state)) return res.status(400).json({ error: 'Choose a US state.' })
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return res.status(400).json({ error: 'Enter a 5-digit ZIP code.' })
  if (cardName.length < 2) return res.status(400).json({ error: 'Enter the name on the card.' })
  if (!/^\d{2}\/\d{2}$/.test(exp)) return res.status(400).json({ error: 'Enter an expiry as MM/YY.' })
  const month = Number(exp.slice(0, 2))
  if (month < 1 || month > 12) return res.status(400).json({ error: 'Enter a valid expiry month.' })
  if (cvc.length < 3 || cvc.length > 4) return res.status(400).json({ error: 'Enter the card security code.' })
  if (rawItems.length < 1 || rawItems.length > 20) {
    return res.status(400).json({ error: 'Your cart is empty.' })
  }

  const variantStmt = db.prepare(
    `SELECT v.id, v.label, v.price_cents, v.sku, p.title, p.handle
     FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.id = ?`
  )

  const lines: Array<{
    variantId: number
    title: string
    handle: string
    label: string
    sku: string
    qty: number
    unit_cents: number
  }> = []

  for (const raw of rawItems) {
    const variantId = Number(raw?.variantId)
    const qty = Number(raw?.qty)
    if (!Number.isInteger(variantId) || !Number.isInteger(qty) || qty < 1 || qty > 9) {
      return res.status(400).json({ error: 'Check the quantities in your cart.' })
    }
    const variant = variantStmt.get(variantId) as
      | { id: number; label: string; price_cents: number; sku: string; title: string; handle: string }
      | undefined
    if (!variant) return res.status(400).json({ error: 'A product in your cart is no longer available.' })
    const existing = lines.find((line) => line.variantId === variant.id)
    if (existing) {
      if (existing.qty + qty > 9) return res.status(400).json({ error: 'Maximum 9 of each variant.' })
      existing.qty += qty
    } else {
      lines.push({
        variantId: variant.id,
        title: variant.title,
        handle: variant.handle,
        label: variant.label,
        sku: variant.sku,
        qty,
        unit_cents: variant.price_cents,
      })
    }
  }

  if (cardNumber !== '4242424242424242') {
    return res.status(402).json({
      error: 'Card declined. This demo accepts only the test card 4242 4242 4242 4242. No charge was attempted.',
      code: 'card_declined',
    })
  }

  const subtotal = lines.reduce((sum, line) => sum + line.unit_cents * line.qty, 0)
  const shipping = shippingCents(subtotal)
  const total = subtotal + shipping

  let publicId = ''
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `NL-${crypto.randomInt(100000, 999999)}`
    const taken = db.prepare('SELECT id FROM orders WHERE public_id = ?').get(candidate)
    if (!taken) {
      publicId = candidate
      break
    }
  }
  if (!publicId) return res.status(500).json({ error: 'Could not reserve an order number. Try again.' })

  const insertOrder = db.prepare(
    `INSERT INTO orders (
      public_id, email, ship_name, line1, line2, city, state, zip,
      subtotal_cents, shipping_cents, total_cents, card_brand, card_last4, created_at
    ) VALUES (
      @public_id, @email, @ship_name, @line1, @line2, @city, @state, @zip,
      @subtotal_cents, @shipping_cents, @total_cents, @card_brand, @card_last4, @created_at
    )`
  )
  const insertItem = db.prepare(
    `INSERT INTO order_items (
      order_id, product_title, product_handle, variant_label, sku, qty, unit_cents
    ) VALUES (
      @order_id, @product_title, @product_handle, @variant_label, @sku, @qty, @unit_cents
    )`
  )

  const place = db.transaction(() => {
    const info = insertOrder.run({
      public_id: publicId,
      email,
      ship_name: name,
      line1,
      line2,
      city,
      state,
      zip,
      subtotal_cents: subtotal,
      shipping_cents: shipping,
      total_cents: total,
      card_brand: 'Visa',
      card_last4: '4242',
      created_at: new Date().toISOString(),
    })
    for (const line of lines) {
      insertItem.run({
        order_id: info.lastInsertRowid,
        product_title: line.title,
        product_handle: line.handle,
        variant_label: line.label,
        sku: line.sku,
        qty: line.qty,
        unit_cents: line.unit_cents,
      })
    }
    return Number(info.lastInsertRowid)
  })

  const orderId = place()
  const order = publicOrder(orderId)
  res.status(201).json({
    demo: true,
    charged: false,
    message: 'Demo order saved. No card was charged.',
    order,
  })
})

app.get('/api/orders/:publicId', (req, res) => {
  const order = db.prepare('SELECT id FROM orders WHERE public_id = ?').get(req.params.publicId) as
    | { id: number }
    | undefined
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  res.json({ demo: true, charged: false, order: publicOrder(order.id) })
})

app.post('/api/admin/login', (req, res) => {
  const password = String(req.body?.password || '')
  if (!shaEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'That password is not valid.' })
  }
  res.cookie('nl_admin', adminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.headers['x-forwarded-proto'] === 'https',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  })
  res.json({ ok: true })
})

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('nl_admin', { path: '/' })
  res.json({ ok: true })
})

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT id FROM orders ORDER BY id DESC').all() as { id: number }[]
  res.json({ orders: rows.map((row) => publicOrder(row.id)) })
})

function sendStorefront(res: express.Response) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.sendFile(path.join(DIST, 'index.html'))
}

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(`${path.sep}index.html`)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      }
    },
  }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    sendStorefront(res)
  })
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found.' })
  res.status(404).type('text').send('Storefront is not built yet. Run npm run build.')
})

app.listen(PORT, HOST, () => {
  console.log(`Northline Supply listening on http://${HOST}:${PORT}`)
})
