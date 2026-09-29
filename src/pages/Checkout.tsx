import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkout } from '../api'
import { shippingCents, useCart } from '../cart'
import { shellLabel } from '../lib/shell'
import { money } from '../types'

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD',
  'TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

function formatCard(value: string) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExp(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function Checkout() {
  const { lines, subtotal, clear } = useCart()
  const navigate = useNavigate()
  const shipping = shippingCents(subtotal)
  const total = subtotal + shipping
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [exp, setExp] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    setPending(true)
    try {
      const result = await checkout({
        email: form.get('email'),
        shipping: {
          name: form.get('name'),
          line1: form.get('line1'),
          line2: form.get('line2'),
          city: form.get('city'),
          state: form.get('state'),
          zip: form.get('zip'),
        },
        card: {
          name: form.get('cardName'),
          number: cardNumber,
          exp,
          cvc: form.get('cvc'),
        },
        items: lines.map((line) => ({ variantId: line.variantId, qty: line.qty })),
      })
      clear()
      navigate(`/orders/${result.order.public_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.')
    } finally {
      setPending(false)
    }
  }

  if (lines.length === 0) {
    return (
      <div className="wrap page-head">
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
        <Link className="btn" to="/collections/all">Continue shopping</Link>
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Checkout</h1>
      </header>
      <form className="checkout" onSubmit={onSubmit}>
        <div>
          <p className="demo-note">
            Demo checkout. This form does not contact Stripe and does not place a live charge.
            The test card <strong>4242 4242 4242 4242</strong> is accepted. Any other number is declined.
            Use any future-looking expiry, such as 12/28, and any 3-digit CVC.
          </p>
          {error && <p className="error">{error}</p>}
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </label>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '18px 0 10px' }}>US shipping address</h2>
          <label className="field">
            <span>Full name</span>
            <input name="name" autoComplete="name" required />
          </label>
          <label className="field">
            <span>Address</span>
            <input name="line1" autoComplete="address-line1" required placeholder="Street address" />
          </label>
          <label className="field">
            <span>Apartment, suite (optional)</span>
            <input name="line2" autoComplete="address-line2" />
          </label>
          <div className="row-2">
            <label className="field">
              <span>City</span>
              <input name="city" autoComplete="address-level2" required />
            </label>
            <label className="field">
              <span>State</span>
              <select name="state" autoComplete="address-level1" required defaultValue="">
                <option value="" disabled>Select</option>
                {STATES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>ZIP code</span>
            <input name="zip" autoComplete="postal-code" required inputMode="numeric" placeholder="10001" />
          </label>

          <div className="card-box">
            <h2>Card</h2>
            <label className="field">
              <span>Name on card</span>
              <input name="cardName" autoComplete="cc-name" required />
            </label>
            <label className="field">
              <span>Card number</span>
              <input
                name="number"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
                onChange={(event) => setCardNumber(formatCard(event.target.value))}
                required
              />
            </label>
            <div className="row-2">
              <label className="field">
                <span>Expiry</span>
                <input
                  name="exp"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  value={exp}
                  onChange={(event) => setExp(formatExp(event.target.value))}
                  required
                />
              </label>
              <label className="field">
                <span>CVC</span>
                <input name="cvc" inputMode="numeric" autoComplete="cc-csc" placeholder="123" required maxLength={4} />
              </label>
            </div>
          </div>
          <button className="btn full" type="submit" disabled={pending}>
            {pending ? 'Placing demo order…' : `Place demo order · ${money(total)}`}
          </button>
        </div>
        <aside className="summary">
          <h2>Order summary</h2>
          {lines.map((line) => (
            <div className="line" key={`${line.sellerProductId ?? 'shop'}:${line.variantId}`}>
              <img src={line.frontImage || `/products/${line.handle}.svg`} alt="" />
              <div>
                <strong>{line.sellerName ?? line.title}</strong>
                <p>
                  {line.label}
                  {line.shell ? ` · ${shellLabel(line.shell)}` : ''}
                  {line.fit ? ` · ${line.fit}` : ''}
                  {line.lengthCm ? ` · hem ${line.lengthCm} cm` : ''}{line.bodyWidthCm ? ` · width ${line.bodyWidthCm}` : ''}{line.neckCm ? ` · neck ${line.neckCm}` : ''}{line.sleeveCm ? ` · sleeve ${line.sleeveCm}` : ''}
                  {' · '}Qty {line.qty}
                </p>
              </div>
              <span>{money(line.unitCents * line.qty)}</span>
            </div>
          ))}
          <div className="totals">
            <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div><span>Shipping</span><span>{shipping === 0 ? 'Free' : money(shipping)}</span></div>
            <div className="grand"><span>Total</span><span>{money(total)}</span></div>
          </div>
        </aside>
      </form>
    </div>
  )
}
