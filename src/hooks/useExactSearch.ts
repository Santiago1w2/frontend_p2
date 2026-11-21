import { useEffect, useState } from 'react'
import { useQuery } from './useQuery'
import { queryCache } from '../lib/queryCache'
import type { QueryKey } from '../lib/queryCache'
import { ApiError } from '../api/errors'

export function useExactSearch<T>(key: QueryKey, id: string | null, loader: (id: string, signal: AbortSignal) => Promise<T | null>) {
  const [settledId, setSettledId] = useState<string | null>(null)
  const query = useQuery<T | null>(key, async signal => {
    try { return await loader(id!, signal) }
    catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') return null
      throw error
    }
  }, Boolean(id) && id === settledId)
  const keyId = JSON.stringify(key)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledId(id), 300)
    return () => window.clearTimeout(timer)
  }, [id])
  useEffect(() => () => queryCache.cancel(JSON.parse(keyId) as QueryKey), [keyId])
  return { ...query, isLoading: Boolean(id) && (id !== settledId || query.isLoading) }
}
