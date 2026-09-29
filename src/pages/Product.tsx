import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct } from '../api'
import { useAccount } from '../account'
import { useCart } from '../cart'
import { shellLabel } from '../lib/shell'
import { useSeller } from '../seller'
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
  const seller = useSeller()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [variantId, setVariantId] = useState<number | null>(null)
  const [added, setAdded] = useState(false)
  const [color, setColor] = useState(() => defaultTeeColor(handle))
  const [motion, setMotion] = useState<BodyMotion>('diam')
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    setProduct(null)
    setAdded(false)
    setError('')
    setColor(defaultTeeColor(handle))
    setMotion('diam')
    setSellerId(null)
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
  const chosen =
    product.kind === 'tee'
      ? seller.products.find((item) => item.id === sellerId) ?? seller.products[0] ?? null
      : null


  function onAddCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const gender = String(form.get('gender') || 'male') === 'female' ? 'female' : 'male'
    const nextError = account.addCharacter({
      name: String(form.get('name') || ''),
      heightCm: Number(form.get('height')),
      weightKg: Number(form.get('weight')),
      gender,
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
            data-character={account.active?.id ?? ''}
            data-gender={account.active?.gender ?? 'male'}
            data-garment={chosen?.shell ?? ''}
            data-length={chosen?.lengthCm ?? ''}
            data-width={chosen?.bodyWidthCm ?? ''}
            data-neck={chosen?.neckCm ?? ''}
            data-sleeve={chosen?.sleeveCm ?? ''}
            data-sleeve-length={chosen?.sleeveLengthCm ?? ''}
            data-seller={chosen?.id ?? ''}
          >
            <ProductStage
              kind={product.kind}
              handle={product.handle}
              heightCm={heightCm}
              weightKg={weightKg}
              color={color}
              motion={motion}
              garment={chosen?.shell ?? 'short'}
              lengthCm={chosen?.lengthCm ?? 80}
              bodyWidthCm={chosen?.bodyWidthCm}
              neckCm={chosen?.neckCm}
              sleeveCm={chosen?.sleeveCm}
              sleeveLengthCm={chosen?.sleeveLengthCm}
              shellOn={Boolean(chosen)}
              frontUrl={chosen?.frontImage ?? null}
              backUrl={chosen?.backImage ?? null}
            />
          </div>
        </div>
        <p className="stage-caption">
          {product.kind === 'tee'
            ? 'Drag to orbit. Height stretches the body vertically. Weight changes chest and waist width. This is a demo, not a body scan.'
            : 'Drag to rotate. The frame is a preview — the print ships unframed.'}
        </p>
        {product.kind === 'tee' && (
          <>
            {account.active ? (
              <p className="stage-caption preview-follows">
                Preview follows {account.active.name} ({account.active.gender === 'female' ? 'female' : 'male'}, {account.active.heightCm} cm, {account.active.weightKg} kg).
              </p>
            ) : null}
            {account.active?.gender === 'female' ? (
              <p className="stage-caption">
                No separate CC0 female base mesh is loaded, so the body shown is still the CC0 male mesh.
              </p>
            ) : null}
            <div className="garment-picker" role="group" aria-label="Seller products">
              {seller.products.length === 0 ? (
                <p className="stage-caption">
                  No seller products in this browser. Add one on <Link to="/produk-saya">Produk saya</Link>.
                </p>
              ) : (
                seller.products.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={chosen?.id === item.id ? 'size on' : 'size'}
                    aria-pressed={chosen?.id === item.id}
                    onClick={() => {
                      setSellerId(item.id)
                      setAdded(false)
                    }}
                  >
                    {item.name}
                    <small>
                      {shellLabel(item.shell)} · {item.lengthCm} cm · width {item.bodyWidthCm}
                    </small>
                  </button>
                ))
              )}
            </div>
            {chosen && (
              <p className="stage-caption">
                {chosen.name}: {shellLabel(chosen.shell)}, hem {chosen.lengthCm} cm, width {chosen.bodyWidthCm} cm, neck {chosen.neckCm} cm, opening {chosen.sleeveCm} cm, sleeve {chosen.sleeveLengthCm} cm. Set by the seller.
              </p>
            )}
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
              <a href="https://orange-juice-games.itch.io/male-base-mesh">orange-juice-games</a>.
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
                      <small>
                        {character.gender === 'female' ? 'Female' : 'Male'} · {character.heightCm} cm · {character.weightKg} kg
                      </small>
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Gender</span>
                  <select
                    value={account.active.gender}
                    onChange={(event) =>
                      account.updateCharacter(account.active!.id, {
                        gender: event.target.value === 'female' ? 'female' : 'male',
                      })
                    }
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
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
                  <label className="field">
                    <span>Gender</span>
                    <select name="gender" defaultValue="male">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
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
          disabled={!variant || (product.kind === 'tee' && !chosen)}
          onClick={() => {
            if (!variant) return
            if (product.kind === 'tee') {
              if (!chosen || !fit) return
              add({
                variantId: variant.id,
                handle: product.handle,
                title: product.title,
                label: variant.label,
                unitCents: variant.price_cents,
                sellerProductId: chosen.id,
                sellerName: chosen.name,
                shell: chosen.shell,
                lengthCm: chosen.lengthCm,
                bodyWidthCm: chosen.bodyWidthCm,
                neckCm: chosen.neckCm,
                sleeveCm: chosen.sleeveCm,
                sleeveLengthCm: chosen.sleeveLengthCm,
                frontImage: chosen.frontImage,
                backImage: chosen.backImage,
                fit,
              })
            } else {
              add({
                variantId: variant.id,
                handle: product.handle,
                title: product.title,
                label: variant.label,
                unitCents: variant.price_cents,
              })
            }
            setAdded(true)
          }}
        >
          Add to cart
        </button>
        {added && variant && (
          <p className="added">
            Added {chosen?.name ?? product.title}, {variant.label}
            {fit ? `, ${fit}` : ''}. <Link to="/cart">View cart</Link>
          </p>
        )}
        <p className="details" style={{ marginTop: 18 }}>
          Made to order. Ships from the US in this demo — no live fulfillment.
        </p>
      </div>
    </div>
  )
}
