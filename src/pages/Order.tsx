import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchOrder } from '../api'
import { money, type Order } from '../types'

export function OrderPage() {
  const { publicId = '' } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchOrder(publicId).then(setOrder).catch((err: Error) => setError(err.message))
  }, [publicId])

  if (error) {
    return (
      <div className="wrap page-head">
        <h1>Order not found</h1>
        <p>{error}</p>
      </div>
    )
  }
  if (!order) return <div className="wrap loading">Loading order…</div>

  const when = new Date(order.created_at).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="wrap confirm">
      <span className="badge">Demo · not charged</span>
      <h1>Order {order.public_id}</h1>
      <p>
        Thanks. We saved this order and sent nothing to a payment network. Card ending {order.card_last4} was not charged.
        A receipt copy would go to {order.email}.
      </p>
      <div className="address">
        <strong>{order.ship_name}</strong>
        <div>{order.line1}</div>
        {order.line2 && <div>{order.line2}</div>}
        <div>{order.city}, {order.state} {order.zip}</div>
        <div className="note" style={{ marginTop: 8 }}>{when} ET</div>
      </div>
      {order.items.map((item) => (
        <div className="line" key={`${item.sku}-${item.variant_label}`}>
          <img src={`/products/${item.product_handle}.svg`} alt="" />
          <div>
            <h2>{item.product_title}</h2>
            <p>{item.variant_label} · Qty {item.qty}</p>
          </div>
          <span>{money(item.unit_cents * item.qty)}</span>
        </div>
      ))}
      <div className="totals">
        <div><span>Subtotal</span><span>{money(order.subtotal_cents)}</span></div>
        <div><span>Shipping</span><span>{order.shipping_cents === 0 ? 'Free' : money(order.shipping_cents)}</span></div>
        <div className="grand"><span>Total</span><span>{money(order.total_cents)}</span></div>
      </div>
      <Link to="/collections/all">Keep shopping</Link>
    </div>
  )
}
