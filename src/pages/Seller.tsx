import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { GARMENT_OPTIONS, LENGTH_MAX, LENGTH_MIN, shellLabel, type Garment } from '../lib/shell'
import { useSeller } from '../seller'

async function readImage(file: File): Promise<string | null> {
  const name = file.name.toLowerCase()
  const png = file.type === 'image/png' || name.endsWith('.png')
  const jpeg = file.type === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg')
  if (!png && !jpeg) return null
  const bitmap = await createImageBitmap(file)
  const max = 480
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

export function SellerPage() {
  const { products, addProduct, removeProduct } = useSeller()
  const [error, setError] = useState('')
  const [front, setFront] = useState<string | null>(null)
  const [back, setBack] = useState<string | null>(null)

  async function onFile(side: 'front' | 'back', file: File | undefined) {
    if (!file) return
    const url = await readImage(file)
    if (!url) return
    if (side === 'front') setFront(url)
    else setBack(url)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const shell = String(form.get('shell') || 'short') as Garment
    const next = addProduct({
      name: String(form.get('name') || ''),
      shell,
      lengthCm: Number(form.get('length')),
      frontImage: front,
      backImage: back,
    })
    setError(next ?? '')
    if (!next) {
      event.currentTarget.reset()
      setFront(null)
      setBack(null)
    }
  }

  return (
    <div className="wrap seller">
      <header className="page-head">
        <p className="kicker">Seller</p>
        <h1>Produk saya</h1>
        <p className="demo-account">
          This is a demo catalog. Products stay in this browser only and are not uploaded. Shoppers try them on from the tee page. They do not get this form.
        </p>
      </header>
      <div className="account-grid">
        <form className="seller-form" onSubmit={onSubmit}>
          <h2>New product</h2>
          <label className="field">
            <span>Name</span>
            <input name="name" required maxLength={60} placeholder="Harbor tee" />
          </label>
          <label className="field">
            <span>Shell</span>
            <select name="shell" defaultValue="short">
              {GARMENT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Length (cm)</span>
            <input name="length" type="number" min={LENGTH_MIN} max={LENGTH_MAX} defaultValue={70} required />
          </label>
          <p className="note">
            Length only moves the hem, from the waist ({LENGTH_MIN} cm) down to the upper thigh ({LENGTH_MAX} cm).
          </p>
          <div className="fabric-row">
            <label className="field">
              <span>Front image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                onChange={(event) => void onFile('front', event.target.files?.[0])}
              />
            </label>
            <label className="field">
              <span>Back image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                onChange={(event) => void onFile('back', event.target.files?.[0])}
              />
            </label>
          </div>
          {(front || back) && (
            <div className="seller-thumbs">
              {front && <img src={front} alt="Front preview" />}
              {back && <img src={back} alt="Back preview" />}
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit">
            Save product
          </button>
        </form>
        <section>
          <h2>Catalog</h2>
          {products.length === 0 ? (
            <p className="details">No products yet. Saved pieces show up on the tee try-on.</p>
          ) : (
            <ul className="seller-list">
              {products.map((product) => (
                <li key={product.id}>
                  {product.frontImage ? <img src={product.frontImage} alt="" /> : <span className="swatch plain" />}
                  <div>
                    <strong>{product.name}</strong>
                    <p>
                      {shellLabel(product.shell)} · {product.lengthCm} cm
                    </p>
                  </div>
                  <button className="linkish" type="button" onClick={() => removeProduct(product.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="details">
            <Link to="/products/northline-heavyweight-tee">Open the try-on</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
