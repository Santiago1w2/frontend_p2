import { useRef, useState } from 'react'
import { session } from '../lib/session'
export function useAction<Args, Result>(action: (args: Args) => Promise<Result>, onSuccess?: (result: Result) => void | Promise<void>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const locked = useRef(false)
  async function run(args: Args) {
    if (locked.current) return
    locked.current = true
    setPending(true)
    setError(null)
    const scope = session.signal()
    try {
      const result = await action(args)
      if (!scope.aborted) { await onSuccess?.(result); return result }
    } catch (error) { if (!scope.aborted) setError(error) }
    finally { setPending(false); locked.current = false }
  }
  return { run, pending, error, reset: () => setError(null) }
}
