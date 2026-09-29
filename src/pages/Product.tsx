import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct } from '../api'
import { useAccount } from '../account'
import { useCart } from '../cart'
import { ProductStage, type BodyMotion } from '../components/ProductStage'
import { DEMO_SIZE_CHART, estimatedChestCm, fitFor, fitGloss } from '../lib/fit'
import { TEE_COLORS, defaultTeeColor } from '../teeColors'
import { money, type Product } from '../types'

function RangeField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    setText(String(value))
  }, [value])
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        type="number"
        min={min}
        max={max}
        step={1}
        value={text}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          const parsed = Number(next)
          if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onCommit(parsed)
        }}
      />
    </label>
  )
}

export function ProductPage() {
  const { handle = '' } = useParams()
  const { add } = useCart()
  const account = useAccount()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [variantId, setVariantId] = useState<number | null>(null)
  const [added, setAdded] = useState(false)
  const [color, setColor] = useState(() => defaultTeeColor(handle))
  const [motion, setMotion] = useState<BodyMotion>('diam')
  const [addError, setAddError] = useState('')

  useEffect(() => {
    setProduct(null)
    setAdded(false)
    setError('')
    setColor(defaultTeeColor(handle))
    setMotion('diam')
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
  const heightCm = account.active?.heightCm ?? 175
  const weightKg = account.active?.weightKg ?? 70
  const chest = estimatedChestCm(weightKg)
  const fit = product.kind === 'tee' && variant ? fitFor(variant.label, chest) : null

  function onAddCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextError = account.addCharacter({
      name: String(form.get('name') || ''),
      heightCm: Number(form.get('height')),
      weightKg: Number(form.get('weight')),
    })
    setAddError(nextError ?? '')
    if (!nextError) event.currentTarget.reset()
  }

  return (
    <div className="wrap product">
      <div className="gallery">
        <div className={product.kind === 'tee' ? 'stage-row' : undefined}>
          <div
            className="media stage"
            data-preview={product.kind === 'tee' ? 'body' : 'frame'}
            data-height={heightCm}
            data-weight={weightKg}
            data-chest={chest}
            data-fit={fit ?? ''}
          >
            <ProductStage
              kind={product.kind}
              handle={product.handle}
              heightCm={heightCm}
              weightKg={weightKg}
              color={color}
              motion={motion}
            />
          </div>
        </div>
        {product.kind === 'tee' && fit && (
          <aside className="fit-badge" aria-live="polite">
            <p className="kicker">Fit</p>
            <strong data-fit-word={fit}>{fit}</strong>
            <p className="fit-gloss">{fitGloss(fit)}</p>
            <p>Est. chest {chest} cm</p>
            <p>Size {variant?.label}</p>
            <p className="note">Demo size chart, not a real factory chart.</p>
            <ul className="chart">
              {DEMO_SIZE_CHART.map((row) => (
                <li key={row.label} className={row.label === variant?.label ? 'on' : undefined}>
                  <span>{row.label}</span>
                  <span>
                    {row.min}–{row.max} cm
                  </span>
                </li>
              ))}
            </ul>
            <p className="note">Estimate, not a body scan.</p>
          </aside>
        )}
        <p className="stage-caption">
          {product.kind === 'tee'
            ? 'Drag to orbit. Height stretches the body vertically. Weight changes chest and waist width. This is a demo, not a body scan.'
            : 'Drag to rotate. The frame is a preview — the print ships unframed.'}
        </p>
        {product.kind === 'tee' && (
          <>
            <div className="anim-picker" role="group" aria-label="Animation">
              {(
                [
                  ['diam', 'Diam'],
                  ['putar', 'Putar'],
                  ['jalan', 'Jalan'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={motion === id ? 'size on' : 'size'}
                  aria-pressed={motion === id}
                  onClick={() => setMotion(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="stage-caption credits">
              Body: CC0. Source:{' '}
              <a href="https://orange-juice-games.itch.io/male-base-mesh">orange-juice-games</a>. Shirt: T Shirt by{' '}
              <a href="https://poly.pizza/m/oZOt671DyI">Nour</a>, CC BY.
            </p>
          </>
        )}
        {product.kind === 'tee' && (
          <div className="char-panel">
            <p className="demo-account">This is a demo, not a real account. Characters stay in this browser only.</p>
            {account.email && account.active ? (
              <>
                <span className="field-label">Character</span>
                <div className="char-list">
                  {account.characters.map((character) => (
                    <button
                      key={character.id}
                      type="button"
                      className={character.id === account.active?.id ? 'size on' : 'size'}
                      onClick={() => account.selectCharacter(character.id)}
                    >
                      {character.name}
                    </button>
                  ))}
                </div>
                <div className="row-2">
                  <RangeField
                    label="Height (cm)"
                    value={account.active.heightCm}
                    min={140}
                    max={210}
                    onCommit={(next) => account.updateCharacter(account.active!.id, { heightCm: next })}
                  />
                  <RangeField
                    label="Weight (kg)"
                    value={account.active.weightKg}
                    min={40}
                    max={160}
                    onCommit={(next) => account.updateCharacter(account.active!.id, { weightKg: next })}
                  />
                </div>
                <form onSubmit={onAddCharacter}>
                  <span className="field-label">Add another character</span>
                  <label className="field">
                    <span>Name</span>
                    <input name="name" required maxLength={40} />
                  </label>
                  <div className="row-2">
                    <label className="field">
                      <span>Height (cm)</span>
                      <input name="height" type="number" min={140} max={210} defaultValue={182} required />
                    </label>
                    <label className="field">
                      <span>Weight (kg)</span>
                      <input name="weight" type="number" min={40} max={160} defaultValue={78} required />
                    </label>
                  </div>
                  {addError && <p className="error">{addError}</p>}
                  <button className="btn secondary" type="submit">
                    Add character
                  </button>
                </form>
              </>
            ) : (
              <p className="details">
                <Link to="/account">Register or log in</Link> to keep a character on this demo. A 175 cm, 70 kg estimate is shown until then.
              </p>
            )}
          </div>
        )}
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
