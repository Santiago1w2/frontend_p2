import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { queryCache } from '../lib/queryCache'
import type { QueryKey } from '../lib/queryCache'
import type { Page } from '../types/lms'
import { session } from '../lib/session'
import { ApiError } from '../api/errors'

export function useQuery<T>(key: QueryKey, loader: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const id = JSON.stringify(key)
  const entry = useMemo(() => queryCache.entry<T>(JSON.parse(id) as QueryKey), [id])
  const loaderRef = useRef(loader)
  useEffect(() => { loaderRef.current = loader })
  const snapshot = useSyncExternalStore(listener => { entry.listeners.add(listener); return () => { entry.listeners.delete(listener) } }, () => entry.snapshot, () => entry.snapshot)
  useEffect(() => {
    if (enabled) void queryCache.load(entry, signal => loaderRef.current(signal))
  }, [entry, enabled, snapshot.revision])
  return { ...snapshot, isLoading: enabled && (snapshot.status === 'idle' || (snapshot.status === 'loading' && snapshot.data === undefined)), refetch: () => queryCache.load(entry, signal => loaderRef.current(signal), true) }
}

interface Collection<T> extends Page<T> { cursors: string[] }
function rowIdentity(item: unknown): string {
  if (item && typeof item === 'object') {
    for (const field of ['enrollmentId', 'contentId', 'evaluationId', 'userId', 'courseId', 'id']) {
      if (field in item) return field + ':' + String((item as Record<string, unknown>)[field])
    }
  }
  return JSON.stringify(item)
}
export function mergePage<T>(current: Collection<T>, page: Page<T>, cursor: string): Collection<T> {
  if (page.nextToken && (page.nextToken === cursor || current.cursors.includes(page.nextToken))) throw new ApiError('INVALID_RESPONSE', 'El servidor repitió un cursor. Actualiza el listado.')
  const unique = new Map([...current.items, ...page.items].map(item => [rowIdentity(item), item]))
  return { items: [...unique.values()], nextToken: page.nextToken, cursors: [...current.cursors, cursor] }
}

export function usePaged<T>(key: QueryKey, loader: (cursor: string | undefined, signal: AbortSignal) => Promise<Page<T>>, enabled = true) {
  const query = useQuery<Collection<T>>(key, async signal => ({ ...await loader(undefined, signal), cursors: [] }), enabled)
  const [pending, setPending] = useState(false)
  const [moreError, setMoreError] = useState<{ key: string; error: unknown } | null>(null)
  const lock = useRef(false)
  async function loadMore() {
    const cursor = query.data?.nextToken
    if (!cursor || lock.current) return
    lock.current = true
    setPending(true)
    setMoreError(null)
    const scope = session.signal()
    try {
      const page = await loader(cursor, scope)
      if (!scope.aborted) queryCache.update<Collection<T>>(key, previous => mergePage(previous ?? { items: [], nextToken: null, cursors: [] }, page, cursor))
    } catch (error) { if (!scope.aborted) setMoreError({ key: JSON.stringify(key), error }) }
    finally { setPending(false); lock.current = false }
  }
  return { ...query, items: query.data?.items ?? [], hasMore: Boolean(query.data?.nextToken), loadMore, loadingMore: pending, moreError: moreError?.key === JSON.stringify(key) ? moreError.error : null }
}
