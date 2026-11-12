import { useEffect,useId,useRef } from 'react'
import type { ButtonHTMLAttributes,ReactNode } from 'react'
import { Icon } from './Icon'

export function Button({ children,loading,variant='primary',className='',disabled,...props }: ButtonHTMLAttributes<HTMLButtonElement>&{ loading?: boolean; variant?: 'primary'|'secondary'|'ghost'|'danger' }) {
  return <button type="button" {...props} disabled={disabled||loading} aria-busy={loading||undefined} className={'button button-'+variant+' '+className}>
    {loading&&<span className="spinner" aria-hidden="true" />}
    {children}
  </button>
}
export function FormField({ label,children,error,hint,id }: { label: string; children: ReactNode; error?: string; hint?: string; id: string }) {
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    {children}
    {hint&&<p className="field-hint" id={id+'-hint'}>{hint}</p>}
    {error&&<p className="field-error" id={id+'-error'} role="alert">{error}</p>}
  </div>
}
export function SearchInput({ value,onChange,label='Buscar en los registros cargados' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const id=useId()
  return <div className="search-input">
    <Icon name="search" size={18} />
    <label className="sr-only" htmlFor={id}>{label}</label>
    <input id={id} type="search" placeholder={label} value={value} onChange={event => onChange(event.target.value)} />
  </div>
}
export function Dialog({ open,onClose,title,children,busy=false,className='' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; busy?: boolean; className?: string }) {
  const dialog=useRef<HTMLDialogElement>(null)
  const titleId=useId()
  useEffect(() => {
    const element=dialog.current
    if(!element) return
    const previous=document.activeElement as HTMLElement|null
    if(open&&!element.open) element.showModal()
    if(!open&&element.open) element.close()
    return () => { if(element.open) element.close(); if(previous?.isConnected) previous.focus() }
  },[open])
  return <dialog ref={dialog} className={'dialog '+className} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if(!busy) onClose() }} onClick={event => { if(event.target===event.currentTarget&&!busy) { const rect=event.currentTarget.getBoundingClientRect(); if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) onClose() } }}>
    <div className="dialog-heading">
      <h2 id={titleId}>{title}</h2>
      <Button variant="ghost" className="icon-button" aria-label="Cerrar diálogo" onClick={onClose} disabled={busy}>
        <Icon name="close" />
      </Button>
    </div>
    {children}
  </dialog>
}
export function ConfirmDialog({ open,onClose,onConfirm,title,description,pending,error }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; pending?: boolean; error?: ReactNode }) {
  return <Dialog open={open} onClose={onClose} title={title} busy={pending}>
    <p className="muted">{description}</p>
    {error}
    <div className="form-actions">
      <Button variant="secondary" onClick={onClose} disabled={pending}>Cancelar</Button>
      <Button onClick={onConfirm} loading={pending}>Confirmar</Button>
    </div>
  </Dialog>
}
