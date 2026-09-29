import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProducts } from '../api'
import { ProductCard } from '../components/ProductCard'
import type { Product } from '../types'

const FILTERS = [
  { kind: 'all', label: 'All' },
  { kind: 'posters', label: 'Posters' },
  { kind: 'tees', label: 'Tees' },
] as const

export function Collection() {
  const { kind = 'all' } = useParams()
  const active = FILTERS.some((item) => item.kind === kind) ? kind : 'all'
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProducts().then(setProducts).catch((err: Error) => setError(err.message))
  }, [])

  const visible = (products ?? []).filter((product) => {
    if (active === 'posters') return product.kind === 'poster'
    if (active === 'tees') return product.kind === 'tee'
    return true
  })

  const title = active === 'posters' ? 'Posters' : active === 'tees' ? 'Heavyweight tees' : 'Shop'

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>{title}</h1>
        <p>
          {active === 'tees'
            ? '7.5 oz cotton, printed to order. Sizes S–XL.'
            : active === 'posters'
              ? 'Matte archival prints in three sizes. Frame not included.'
              : 'Eight pieces. Filter by posters or tees.'}
        </p>
      </header>
      <div className="filters">
        {FILTERS.map((item) => (
          <Link key={item.kind} to={`/collections/${item.kind}`} className={item.kind === active ? 'chip on' : 'chip'}>
            {item.label}
          </Link>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!products && !error && <p className="loading">Loading products…</p>}
      <div className="grid" style={{ paddingBottom: 64 }}>
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
