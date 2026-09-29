import { NavLink, Outlet } from 'react-router-dom'
import { useAccount } from '../account'
import { useCart } from '../cart'

export function Layout() {
  const { count } = useCart()
  const { email } = useAccount()
  return (
    <div className="shell">
      <div className="announce">Demo store · Made to order · Ships from the US · No live charges</div>
      <header className="header">
        <div className="wrap header-inner">
          <NavLink to="/" className="logo">
            Northline
            <small>Supply</small>
          </NavLink>
          <nav className="nav">
            <NavLink to="/collections/all">Shop</NavLink>
            <NavLink to="/collections/posters">Posters</NavLink>
            <NavLink to="/collections/tees">Tees</NavLink>
          </nav>
          <div className="tools">
            <NavLink to="/account">{email ? 'Account' : 'Log in'}</NavLink>
            <NavLink to="/cart">Cart ({count})</NavLink>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site">
        <div className="wrap">
          <span>Northline Supply · print on demand · United States</span>
          <span>Portfolio demo. Cards are not charged.</span>
        </div>
      </footer>
    </div>
  )
}
