import { useEffect,useRef,useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from '../../context/ToastContext'
import { Icon } from '../ui/Icon'
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message,setMessage]=useState('')
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current),[])
  function notify(value: string) { clearTimeout(timer.current); setMessage(value); timer.current=setTimeout(() => setMessage(''),6000) }
  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {message&&<div className="toast">
        <Icon name="check" />
        <span>{message}</span>
        <button aria-label="Cerrar notificación" onClick={() => setMessage('')}>
          <Icon name="close" size={16} />
        </button>
      </div>}
    </div>
  </ToastContext.Provider>
}
