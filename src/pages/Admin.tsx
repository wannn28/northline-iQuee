import { useEffect, useState, type FormEvent } from 'react'
import { adminLogin, adminLogout, fetchAdminOrders } from '../api'
import { money, type Order } from '../types'

export function Admin() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    try {
      const next = await fetchAdminOrders()
      setOrders(next)
      setError('')
    } catch {
      setOrders(null)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await adminLogin(password)
      setPassword('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="wrap admin">
      <header className="page-head">
        <h1>Orders</h1>
        <p>Northline Supply admin. Demo orders only.</p>
      </header>
      {orders === null ? (
        <form className="admin-login" onSubmit={onSubmit}>
          {error && <p className="error">{error}</p>}
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn" type="submit" disabled={pending}>{pending ? 'Checking…' : 'View orders'}</button>
        </form>
      ) : (
        <>
          <div className="admin-bar">
            <span>{orders.length} order{orders.length === 1 ? '' : 's'}</span>
            <button
              className="btn secondary"
              type="button"
              onClick={async () => {
                await adminLogout()
                setOrders(null)
              }}
            >
              Sign out
            </button>
          </div>
          {orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>When</th>
                  <th>Customer</th>
                  <th>Ship to</th>
                  <th>Items</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.public_id}>
                    <td>
                      {order.public_id}
                      <div className="muted">Demo · {order.card_brand} {order.card_last4}</div>
                    </td>
                    <td>
                      {new Date(order.created_at).toLocaleString('en-US', {
                        timeZone: 'America/New_York',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td>{order.email}</td>
                    <td>
                      {order.ship_name}
                      <div className="muted">
                        {order.line1}{order.line2 ? `, ${order.line2}` : ''}, {order.city}, {order.state} {order.zip}
                      </div>
                    </td>
                    <td>
                      {order.items.map((item) => (
                        <div key={`${order.public_id}-${item.sku}`}>
                          {item.qty} × {item.product_title} ({item.variant_label})
                        </div>
                      ))}
                    </td>
                    <td>{money(order.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
