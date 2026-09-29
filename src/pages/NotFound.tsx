import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="wrap page-head">
      <h1>Page not found</h1>
      <p>That link is not part of the shop.</p>
      <Link className="btn" to="/">Back home</Link>
    </div>
  )
}
