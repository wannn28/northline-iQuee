import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct } from '../api'
import { useCart } from '../cart'
import { money, type Product } from '../types'

export function ProductPage() {
  const { handle = '' } = useParams()
  const { add } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [variantId, setVariantId] = useState<number | null>(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    setProduct(null)
    setAdded(false)
    setError('')
    fetchProduct(handle)
      .then((next) => {
        setProduct(next)
        setVariantId(next.variants[0]?.id ?? null)
      })
      .catch((err: Error) => setError(err.message))
  }, [handle])

  if (error) {
    return (
      <div className="wrap page-head">
        <h1>Not in the shop</h1>
        <p>{error}</p>
        <Link to="/collections/all">Back to the collection</Link>
      </div>
    )
  }
  if (!product) return <div className="wrap loading">Loading product…</div>

  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0]

  return (
    <div className="wrap product">
      <div className="media">
        <img src={`/products/${product.handle}.svg`} alt={product.title} />
      </div>
      <div>
        <p className="kicker">{product.kind === 'poster' ? 'Poster' : 'Heavyweight tee'}</p>
        <h1>{product.title}</h1>
        <p className="price">{variant ? money(variant.price_cents) : ''}</p>
        <p className="copy">{product.description}</p>
        <p className="details">{product.details}</p>
        <span className="field-label">{product.kind === 'poster' ? 'Size' : 'Size'}</span>
        <div className="sizes">
          {product.variants.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === variant?.id ? 'size on' : 'size'}
              onClick={() => {
                setVariantId(item.id)
                setAdded(false)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          className="btn full"
          type="button"
          disabled={!variant}
          onClick={() => {
            if (!variant) return
            add({
              variantId: variant.id,
              handle: product.handle,
              title: product.title,
              label: variant.label,
              unitCents: variant.price_cents,
            })
            setAdded(true)
          }}
        >
          Add to cart
        </button>
        {added && variant && (
          <p className="added">
            Added {product.title}, {variant.label}. <Link to="/cart">View cart</Link>
          </p>
        )}
        <p className="details" style={{ marginTop: 18 }}>
          Made to order. Ships from the US in this demo — no live fulfillment.
        </p>
      </div>
    </div>
  )
}
