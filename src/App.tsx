import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AccountPage } from './pages/Account'
import { Admin } from './pages/Admin'
import { CartPage } from './pages/Cart'
import { Checkout } from './pages/Checkout'
import { Collection } from './pages/Collection'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { OrderPage } from './pages/Order'
import { ProductPage } from './pages/Product'
import { SellerPage } from './pages/Seller'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function App() {
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/collections/:kind" element={<Collection />} />
          <Route path="/products/:handle" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders/:publicId" element={<OrderPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/produk-saya" element={<SellerPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
