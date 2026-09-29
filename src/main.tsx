import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AccountProvider } from './account'
import { CartProvider } from './cart'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AccountProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AccountProvider>
    </BrowserRouter>
  </StrictMode>
)
