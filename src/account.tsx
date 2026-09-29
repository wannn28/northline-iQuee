import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Character = {
  id: string
  name: string
  heightCm: number
  weightKg: number
}

type Account = {
  email: string
  password: string
  characters: Character[]
}

type Persisted = {
  accounts: Account[]
  sessionEmail: string | null
  activeCharacterId: string | null
}

const KEY = 'northline-demo-accounts-v1'
const EMPTY: Persisted = { accounts: [], sessionEmail: null, activeCharacterId: null }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Persisted
    if (!parsed || !Array.isArray(parsed.accounts)) return EMPTY
    return {
      accounts: parsed.accounts.filter((account) => account && typeof account.email === 'string'),
      sessionEmail: typeof parsed.sessionEmail === 'string' ? parsed.sessionEmail : null,
      activeCharacterId: typeof parsed.activeCharacterId === 'string' ? parsed.activeCharacterId : null,
    }
  } catch {
    return EMPTY
  }
}

export function clampHeight(n: number) {
  return Math.min(210, Math.max(140, Math.round(n)))
}

export function clampWeight(n: number) {
  return Math.min(160, Math.max(40, Math.round(n)))
}

type AccountContextValue = {
  email: string | null
  characters: Character[]
  active: Character | null
  register: (input: { email: string; password: string; name: string; heightCm: number; weightKg: number }) => string | null
  login: (email: string, password: string) => string | null
  logout: () => void
  addCharacter: (input: { name: string; heightCm: number; weightKg: number }) => string | null
  updateCharacter: (id: string, patch: Partial<Pick<Character, 'name' | 'heightCm' | 'weightKg'>>) => void
  selectCharacter: (id: string) => void
}

const Ctx = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(EMPTY)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setState(load())
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(state))
  }, [state, ready])

  const value = useMemo<AccountContextValue>(() => {
    const session = state.accounts.find((account) => account.email === state.sessionEmail) ?? null
    const active =
      session?.characters.find((character) => character.id === state.activeCharacterId) ??
      session?.characters[0] ??
      null

    return {
      email: session?.email ?? null,
      characters: session?.characters ?? [],
      active,
      register(input) {
        const email = input.email.trim().toLowerCase()
        const name = input.name.trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter an email address.'
        if (input.password.length < 4) return 'Use at least 4 characters. This is a demo, not a real account.'
        if (!name) return 'Name the character.'
        if (state.accounts.some((account) => account.email === email)) {
          return 'That email is already registered in this browser.'
        }
        const character: Character = {
          id: crypto.randomUUID(),
          name,
          heightCm: clampHeight(input.heightCm),
          weightKg: clampWeight(input.weightKg),
        }
        setState((prev) => ({
          accounts: [...prev.accounts, { email, password: input.password, characters: [character] }],
          sessionEmail: email,
          activeCharacterId: character.id,
        }))
        return null
      },
      login(emailRaw, password) {
        const email = emailRaw.trim().toLowerCase()
        const account = state.accounts.find((item) => item.email === email)
        if (!account || account.password !== password) {
          return 'Email or password does not match a demo account in this browser.'
        }
        setState((prev) => ({
          ...prev,
          sessionEmail: email,
          activeCharacterId: account.characters[0]?.id ?? null,
        }))
        return null
      },
      logout() {
        setState((prev) => ({ ...prev, sessionEmail: null, activeCharacterId: null }))
      },
      addCharacter(input) {
        if (!session) return 'Log in first.'
        const name = input.name.trim()
        if (!name) return 'Name the character.'
        const character: Character = {
          id: crypto.randomUUID(),
          name,
          heightCm: clampHeight(input.heightCm),
          weightKg: clampWeight(input.weightKg),
        }
        setState((prev) => ({
          ...prev,
          activeCharacterId: character.id,
          accounts: prev.accounts.map((account) =>
            account.email === session.email
              ? { ...account, characters: [...account.characters, character] }
              : account,
          ),
        }))
        return null
      },
      updateCharacter(id, patch) {
        if (!session) return
        setState((prev) => ({
          ...prev,
          accounts: prev.accounts.map((account) => {
            if (account.email !== session.email) return account
            return {
              ...account,
              characters: account.characters.map((character) => {
                if (character.id !== id) return character
                return {
                  ...character,
                  name: patch.name !== undefined ? patch.name : character.name,
                  heightCm: patch.heightCm !== undefined ? clampHeight(patch.heightCm) : character.heightCm,
                  weightKg: patch.weightKg !== undefined ? clampWeight(patch.weightKg) : character.weightKg,
                }
              }),
            }
          }),
        }))
      },
      selectCharacter(id) {
        if (!session?.characters.some((character) => character.id === id)) return
        setState((prev) => ({ ...prev, activeCharacterId: id }))
      },
    }
  }, [state])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAccount() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('AccountProvider missing')
  return ctx
}
