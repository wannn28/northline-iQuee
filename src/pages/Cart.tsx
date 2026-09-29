import { Link } from 'react-router-dom'
import { lineKey, shippingCents, useCart } from '../cart'
import { shellLabel } from '../lib/shell'
import { money } from '../types'

export function CartPage() {
  const { lines, subtotal, setQty, remove } = useCart()
  const shipping = shippingCents(subtotal)
  const total = subtotal + shipping

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Cart</h1>
      </header>
      {lines.length === 0 ? (
        <div className="empty">
          <p>Your cart is empty.</p>
          <Link className="btn" to="/collections/all">Continue shopping</Link>
        </div>
      ) : (
        <div className="cart-list">
          {lines.map((line) => (
            <div className="line" key={lineKey(line)}>
              <img src={line.frontImage || `/products/${line.handle}.svg`} alt="" />
              <div>
                <h2>
                  <Link to={`/products/${line.handle}`}>{line.sellerName ?? line.title}</Link>
                </h2>
                <p>
                  {line.label}
                  {line.shell ? ` · ${shellLabel(line.shell)}` : ''}
                  {line.fit ? ` · ${line.fit}` : ''}
                  {line.lengthCm ? ` · hem ${line.lengthCm} cm` : ''}{line.bodyWidthCm ? ` · width ${line.bodyWidthCm}` : ''}{line.neckCm ? ` · neck ${line.neckCm}` : ''}{line.sleeveCm ? ` · opening ${line.sleeveCm}` : ''}{line.sleeveLengthCm ? ` · sleeve ${line.sleeveLengthCm} cm` : ''}
                </p>
                <div className="line-actions">
                  <div className="qty">
                    <button type="button" onClick={() => setQty(lineKey(line), line.qty - 1)} aria-label="Decrease quantity">−</button>
                    <span>{line.qty}</span>
                    <button type="button" onClick={() => setQty(lineKey(line), Math.min(9, line.qty + 1))} aria-label="Increase quantity">+</button>
                  </div>
                  <button className="linkish" type="button" onClick={() => remove(lineKey(line))}>Remove</button>
                </div>
              </div>
              <strong>{money(line.unitCents * line.qty)}</strong>
            </div>
          ))}
          <div className="totals">
            <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div><span>Shipping</span><span>{shipping === 0 ? 'Free' : money(shipping)}</span></div>
            <p className="note">Free shipping on orders of $75 and up. Otherwise $6.50 within the US.</p>
            <div className="grand"><span>Total</span><span>{money(total)}</span></div>
            <Link className="btn full" to="/checkout" style={{ marginTop: 12 }}>Checkout</Link>
          </div>
        </div>
      )}
    </div>
  )
}
