import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ProductStage } from '../components/ProductStage'
import {
  GARMENT_OPTIONS,
  LENGTH_MAX,
  LENGTH_MIN,
  NECK_DEFAULT,
  NECK_MAX,
  NECK_MIN,
  SLEEVE_DEFAULT,
  SLEEVE_MAX,
  SLEEVE_MIN,
  WIDTH_DEFAULT,
  WIDTH_MAX,
  WIDTH_MIN,
  clampLength,
  clampNeck,
  clampSleeve,
  clampWidth,
  shellLabel,
  type Garment,
} from '../lib/shell'
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
  const [name, setName] = useState('')
  const [shell, setShell] = useState<Garment>('short')
  const [lengthCm, setLengthCm] = useState(LENGTH_MIN)
  const [bodyWidthCm, setBodyWidthCm] = useState(WIDTH_DEFAULT)
  const [neckCm, setNeckCm] = useState(NECK_DEFAULT)
  const [sleeveCm, setSleeveCm] = useState(SLEEVE_DEFAULT)

  async function onFile(side: 'front' | 'back', file: File | undefined) {
    if (!file) return
    const url = await readImage(file)
    if (!url) return
    if (side === 'front') setFront(url)
    else setBack(url)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = addProduct({
      name,
      shell,
      lengthCm,
      bodyWidthCm,
      neckCm,
      sleeveCm,
      frontImage: front,
      backImage: back,
    })
    setError(next ?? '')
    if (!next) {
      setName('')
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
      <div className="seller-editor">
        <form className="seller-form" onSubmit={onSubmit}>
          <h2>New product</h2>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} placeholder="Harbor tee" />
          </label>
          <label className="field">
            <span>Shell</span>
            <select value={shell} onChange={(event) => setShell(event.target.value as Garment)}>
              {GARMENT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Length (cm)</span>
            <input
              type="number"
              min={LENGTH_MIN}
              max={LENGTH_MAX}
              value={lengthCm}
              required
              onChange={(event) => setLengthCm(clampLength(Number(event.target.value)))}
            />
          </label>
          <label className="field">
            <span>Body width (cm)</span>
            <input
              type="number"
              min={WIDTH_MIN}
              max={WIDTH_MAX}
              value={bodyWidthCm}
              required
              onChange={(event) => setBodyWidthCm(clampWidth(Number(event.target.value)))}
            />
          </label>
          <label className="field">
            <span>Neck opening (cm)</span>
            <input
              type="number"
              min={NECK_MIN}
              max={NECK_MAX}
              value={neckCm}
              required
              onChange={(event) => setNeckCm(clampNeck(Number(event.target.value)))}
            />
          </label>
          <label className="field">
            <span>Sleeve opening (cm)</span>
            <input
              type="number"
              min={SLEEVE_MIN}
              max={SLEEVE_MAX}
              value={sleeveCm}
              required
              onChange={(event) => setSleeveCm(clampSleeve(Number(event.target.value)))}
            />
          </label>
          <p className="note">
            Length moves the hem only, from the waist ({LENGTH_MIN} cm) to the upper thigh ({LENGTH_MAX} cm). Neck and sleeve openings are smooth circles with a thin binding. The shoulder stays covered.
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
        <div>
          <h2>Preview</h2>
          <div
            className="media stage"
            data-preview="seller"
            data-garment={shell}
            data-length={lengthCm}
            data-width={bodyWidthCm}
            data-neck={neckCm}
            data-sleeve={sleeveCm}
          >
            <ProductStage
              kind="tee"
              handle="seller-draft"
              heightCm={175}
              weightKg={70}
              motion="diam"
              garment={shell}
              lengthCm={lengthCm}
              bodyWidthCm={bodyWidthCm}
              neckCm={neckCm}
              sleeveCm={sleeveCm}
              shellOn
              frontUrl={front}
              backUrl={back}
            />
          </div>
          <p className="stage-caption">Updates as you edit. Saved in this browser only.</p>
        </div>
      </div>
      <section className="seller-catalog">
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
                    {shellLabel(product.shell)} · hem {product.lengthCm} cm · width {product.bodyWidthCm} cm · neck {product.neckCm} cm · sleeve {product.sleeveCm} cm
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
  )
}
