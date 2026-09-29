import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts } from '../api'
import { ProductCard } from '../components/ProductCard'
import { money, type Product } from '../types'

export function Home() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProducts().then(setProducts).catch((err: Error) => setError(err.message))
  }, [])

  const featured = products?.slice(0, 4) ?? []
  const hero = products?.[0]

  return (
    <>
      <div className="wrap">
        <section className="hero">
          <div>
            <p className="eyebrow">Print-on-demand · United States</p>
            <h1>Posters and heavyweight tees, made after you order.</h1>
            <p className="lede">
              Northline Supply prints small runs of graphic posters and 7.5 oz shirts. Nothing is held in a warehouse.
              Each piece is made when the order comes in, then ships from the US.
            </p>
            <div className="actions">
              <Link className="btn" to="/collections/all">Shop the collection</Link>
              <Link className="btn secondary" to="/collections/posters">Posters</Link>
            </div>
          </div>
          {hero && (
            <Link to={`/products/${hero.handle}`} className="hero-card">
              <img src={`/products/${hero.handle}.svg`} alt={hero.title} />
              <figcaption>
                <strong>{hero.title}</strong>
                <span>{money(hero.variants[0]?.price_cents ?? hero.price_cents)}</span>
              </figcaption>
            </Link>
          )}
        </section>
      </div>

      <div className="wrap">
        <section className="trust">
          <article>
            <h2>Made to order</h2>
            <p>Printed after checkout. Allow a few business days before it leaves the shop.</p>
          </article>
          <article>
            <h2>Ships from the US</h2>
            <p>Domestic labels only. This demo does not book a live carrier.</p>
          </article>
          <article>
            <h2>Easy returns</h2>
            <p>30 days on unworn shirts and undamaged posters. Demo orders are not fulfilled.</p>
          </article>
        </section>
      </div>

      <div className="wrap section">
        <div className="section-head">
          <h2>Featured</h2>
          <Link to="/collections/all">View all</Link>
        </div>
        {error && <p className="error">{error}</p>}
        {!products && !error && <p className="loading">Loading the shop…</p>}
        <div className="grid">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </>
  )
}
