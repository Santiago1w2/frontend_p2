export type QueryKey = readonly unknown[]
export interface Snapshot<T> { data?: T; error: unknown; status: 'idle' | 'loading' | 'success' | 'error'; fetching: boolean; revision: number }
interface Entry<T> { key: QueryKey; snapshot: Snapshot<T>; listeners: Set<() => void>; controller?: AbortController; promise?: Promise<void>; updatedAt: number }
const entries = new Map<string, Entry<unknown>>()
function emit<T>(entry: Entry<T>, snapshot: Snapshot<T>) {
  entry.snapshot = snapshot
  entry.listeners.forEach(listener => listener())
}
export const queryCache = {
  entry<T>(key: QueryKey): Entry<T> {
    const id = JSON.stringify(key)
    let entry = entries.get(id)
    if (!entry) {
      entry = { key, snapshot: { error: null, status: 'idle', fetching: false, revision: 0 }, listeners: new Set(), updatedAt: 0 }
      entries.set(id, entry)
    }
    return entry as Entry<T>
  },
  async load<T>(entry: Entry<T>, loader: (signal: AbortSignal) => Promise<T>, force = false): Promise<void> {
    if (entry.promise) return entry.promise
    if (!force && entry.snapshot.status === 'success' && Date.now() - entry.updatedAt < 60000) return
    const controller = new AbortController()
    entry.controller = controller
    emit(entry, { ...entry.snapshot, fetching: true, error: null, status: entry.snapshot.data === undefined ? 'loading' : entry.snapshot.status })
    entry.promise = (async () => {
      try {
        const data = await loader(controller.signal)
        if (!controller.signal.aborted) {
          entry.updatedAt = Date.now()
          emit(entry, { ...entry.snapshot, data, error: null, status: 'success', fetching: false })
        }
      } catch (error) {
        if (!controller.signal.aborted) emit(entry, { ...entry.snapshot, error, status: 'error', fetching: false })
      } finally { if (entry.controller === controller) entry.promise = undefined }
    })()
    return entry.promise
  },
  update<T>(key: QueryKey, update: (previous: T | undefined) => T) {
    const entry = this.entry<T>(key)
    entry.updatedAt = Date.now()
    emit(entry, { ...entry.snapshot, data: update(entry.snapshot.data), status: 'success', error: null, fetching: false })
  },
  cancel(key: QueryKey) {
    const entry = entries.get(JSON.stringify(key))
    if (!entry?.promise) return
    entry.controller?.abort()
    entry.controller = undefined
    entry.promise = undefined
    emit(entry, { ...entry.snapshot, fetching: false, status: entry.snapshot.data === undefined ? 'idle' : 'success', error: null })
  },
  invalidate(prefix: QueryKey) {
    entries.forEach(entry => {
      if (prefix.every((part, index) => JSON.stringify(part) === JSON.stringify(entry.key[index]))) {
        entry.controller?.abort()
        entry.promise = undefined
        entry.updatedAt = 0
        emit(entry, { ...entry.snapshot, revision: entry.snapshot.revision + 1 })
      }
    })
  },
  clear() {
    entries.forEach(entry => {
      entry.controller?.abort()
      emit(entry, { error: null, status: 'idle', fetching: false, revision: entry.snapshot.revision + 1 })
    })
    entries.clear()
  },
}
