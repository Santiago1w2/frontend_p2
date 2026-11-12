type SessionReason = 'login' | 'logout' | 'expired' | 'external'
type Listener = (reason: SessionReason) => void
function readStorage(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}
let token = readStorage('token') ?? ''
let expiresAt = Number(readStorage('folio.expiresAt')) || 0
let controller = new AbortController()
const listeners = new Set<Listener>()
function writeStorage() {
  try {
    if (token) {
      localStorage.setItem('token', token)
      localStorage.setItem('folio.expiresAt', String(expiresAt))
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('folio.expiresAt')
    }
  } catch { return }
}
function replace(next: string, expiry: number, reason: SessionReason, persist = true) {
  controller.abort()
  controller = new AbortController()
  token = next
  expiresAt = expiry
  if (persist) writeStorage()
  listeners.forEach(listener => listener(reason))
}
export const session = {
  token: () => token,
  expiresAt: () => expiresAt,
  signal: () => controller.signal,
  save: (value: string, seconds: number) => replace(value, Date.now() + seconds * 1000, 'login'),
  clear: (reason: 'logout' | 'expired' = 'logout') => replace('', 0, reason),
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  sync() {
    const stored = readStorage('token') ?? ''
    if (stored !== token) replace(stored, Number(readStorage('folio.expiresAt')) || 0, 'external', false)
  },
}
export function preference(key: string, fallback: string): string { return readStorage(`folio.${key}`) ?? fallback }
export function savePreference(key: string, value: string) {
  try { localStorage.setItem(`folio.${key}`, value) } catch { return }
}
