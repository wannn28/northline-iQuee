import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../account'

export function AccountPage() {
  const { email, characters, active, register, login, logout, addCharacter, selectCharacter } = useAccount()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState('')
  const [addError, setAddError] = useState('')

  function onAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextError =
      mode === 'register'
        ? register({
            email: String(form.get('email') || ''),
            password: String(form.get('password') || ''),
            name: String(form.get('name') || ''),
            heightCm: Number(form.get('height')),
            weightKg: Number(form.get('weight')),
          })
        : login(String(form.get('email') || ''), String(form.get('password') || ''))
    setError(nextError ?? '')
  }

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextError = addCharacter({
      name: String(form.get('name') || ''),
      heightCm: Number(form.get('height')),
      weightKg: Number(form.get('weight')),
    })
    setAddError(nextError ?? '')
    if (!nextError) event.currentTarget.reset()
  }

  return (
    <div className="wrap account">
      <header className="page-head">
        <h1>Account</h1>
        <p className="demo-account">This is a demo, not a real account. Accounts and characters are stored in this browser only.</p>
      </header>

      {email ? (
        <div className="account-grid">
          <section>
            <p className="kicker">Signed in</p>
            <h2>{email}</h2>
            <p className="details">Characters on this demo account stay in localStorage. Nothing is sent to a server.</p>
            <button className="btn secondary" type="button" onClick={logout}>
              Log out
            </button>
          </section>
          <section>
            <h2>Characters</h2>
            <ul className="char-list">
              {characters.map((character) => (
                <li key={character.id}>
                  <button
                    type="button"
                    className={character.id === active?.id ? 'size on' : 'size'}
                    onClick={() => selectCharacter(character.id)}
                  >
                    {character.name}
                    <small>
                      {character.heightCm} cm · {character.weightKg} kg
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={onAdd}>
              <h3>Add a character</h3>
              <label className="field">
                <span>Name</span>
                <input name="name" required maxLength={40} />
              </label>
              <div className="row-2">
                <label className="field">
                  <span>Height (cm)</span>
                  <input name="height" type="number" min={140} max={210} defaultValue={180} required />
                </label>
                <label className="field">
                  <span>Weight (kg)</span>
                  <input name="weight" type="number" min={40} max={160} defaultValue={80} required />
                </label>
              </div>
              {addError && <p className="error">{addError}</p>}
              <button className="btn" type="submit">
                Add character
              </button>
            </form>
            <p className="details">
              <Link to="/collections/tees">Try a tee on the active character</Link>
            </p>
          </section>
        </div>
      ) : (
        <div className="admin-login">
          <div className="filters">
            <button type="button" className={mode === 'register' ? 'chip on' : 'chip'} onClick={() => setMode('register')}>
              Register
            </button>
            <button type="button" className={mode === 'login' ? 'chip on' : 'chip'} onClick={() => setMode('login')}>
              Log in
            </button>
          </div>
          <form onSubmit={onAuth}>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required />
            </label>
            {mode === 'register' && (
              <>
                <label className="field">
                  <span>Character name</span>
                  <input name="name" required maxLength={40} />
                </label>
                <div className="row-2">
                  <label className="field">
                    <span>Height (cm)</span>
                    <input name="height" type="number" min={140} max={210} defaultValue={175} required />
                  </label>
                  <label className="field">
                    <span>Weight (kg)</span>
                    <input name="weight" type="number" min={40} max={160} defaultValue={70} required />
                  </label>
                </div>
              </>
            )}
            {error && <p className="error">{error}</p>}
            <button className="btn full" type="submit">
              {mode === 'register' ? 'Create demo account' : 'Log in'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
