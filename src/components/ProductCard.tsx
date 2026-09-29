import { Link } from 'react-router-dom'
import { priceLabel, type Product } from '../types'

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.handle}`} className="card">
      <div className="media">
        <img src={`/products/${product.handle}.svg`} alt={product.title} />
      </div>
      <h3>{product.title}</h3>
      <div className="meta">
        <span>{product.kind === 'poster' ? 'Poster' : 'Heavyweight tee'}</span>
        <span>{priceLabel(product)}</span>
      </div>
    </Link>
  )
}
