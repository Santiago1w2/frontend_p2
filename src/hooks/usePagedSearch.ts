import { useEffect, useState } from 'react'

interface PagedSource<T> {
  items: T[]
  hasMore: boolean
  error: unknown
  moreError: unknown
  isLoading: boolean
  loadingMore: boolean
  fetching: boolean
  loadMore: () => Promise<void>
}

export function usePagedSearch<T>(query: PagedSource<T>, search: string, matches: (item: T, text: string) => boolean, enabled = true) {
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedSearch = search.trim().toLowerCase()
  const waitingForSearch = normalizedSearch !== searchQuery
  const items = query.items.filter(item => matches(item, searchQuery))
  const seeking = enabled && items.length === 0 && query.hasMore && !query.error && !query.moreError
  const { isLoading, loadingMore, fetching, loadMore } = query
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(normalizedSearch), 300)
    return () => window.clearTimeout(timer)
  }, [normalizedSearch])
  useEffect(() => {
    if (seeking && !waitingForSearch && !isLoading && !loadingMore && !fetching) void loadMore()
  }, [seeking, waitingForSearch, isLoading, loadingMore, fetching, loadMore])
  return { items, searchQuery, seeking, isLoading: isLoading || waitingForSearch || seeking }
}
