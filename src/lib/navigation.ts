import { useSyncExternalStore } from 'react'
const listeners = new Set<() => void>()
function changed() { listeners.forEach(listener => listener()) }
if (typeof window !== 'undefined') window.addEventListener('popstate', changed)
export function navigate(path: string, replace = false) {
  if (!path.startsWith('/') || path.startsWith('//')) return
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  changed()
}
export function useLocation() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => window.location.pathname + window.location.search, () => '/')
}
