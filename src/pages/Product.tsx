import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct } from '../api'
import { useCart } from '../cart'
import { ProductStage } from '../components/ProductStage'
import { TEE_COLORS, defaultTeeColor } from '../teeColors'
import { money, type Product } from '../types'

export function ProductPage() {
  const { handle = '' } = useParams()
  const { add } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [variantId, setVariantId] = useState<number | null>(null)
  const [added, setAdded] = useState(false)
  const [color, setColor] = useState(() => defaultTeeColor(handle))

  useEffect(() => {
    setProduct(null)
    setAdded(false)
    setError('')
    setColor(defaultTeeColor(handle))
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
  const selectedColor = TEE_COLORS.find((swatch) => swatch.hex === color)
  const description =
    product.kind === 'tee' && selectedColor
      ? product.description.replace(/^(Charcoal|Olive|Navy|Sand)(?=\b)/, selectedColor.label)
      : product.description

  return (
    <div className="wrap product">
      <div className="gallery">
        <div className="media stage">
          <ProductStage kind={product.kind} handle={product.handle} color={color} />
        </div>
        <p className="stage-caption">
          {product.kind === 'tee'
            ? 'Drag to rotate. Color swatches recolor this preview only.'
            : 'Drag to rotate. The frame is a preview — the print ships unframed.'}
        </p>
      </div>
      <div>
        <p className="kicker">{product.kind === 'poster' ? 'Poster' : 'Heavyweight tee'}</p>
        <h1>{product.title}</h1>
        <p className="price">{variant ? money(variant.price_cents) : ''}</p>
        <p className="copy">{description}</p>
        <p className="details">{product.details}</p>
        {product.kind === 'tee' && (
          <>
            <span className="field-label">Color</span>
            <div className="swatches">
              {TEE_COLORS.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  className={color === swatch.hex ? 'swatch on' : 'swatch'}
                  style={{ background: swatch.hex }}
                  aria-label={swatch.label}
                  aria-pressed={color === swatch.hex}
                  onClick={() => setColor(swatch.hex)}
                />
              ))}
            </div>
          </>
        )}
        <span className="field-label">Size</span>
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
