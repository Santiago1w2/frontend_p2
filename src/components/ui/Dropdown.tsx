import { useEffect,useId,useRef,useState } from 'react'
import type { ReactNode,KeyboardEvent } from 'react'
export function Dropdown({ label,children,className='',ariaLabel }: { label: ReactNode; children: ReactNode; className?: string; ariaLabel: string }) {
  const [open,setOpen]=useState(false)
  const root=useRef<HTMLDivElement>(null)
  const trigger=useRef<HTMLButtonElement>(null)
  const content=useRef<HTMLDivElement>(null)
  const id=useId()
  useEffect(() => {
    if(!open) return
    content.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()
    function outside(event: PointerEvent) { if(!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown',outside)
    return () => document.removeEventListener('pointerdown',outside)
  },[open])
  function keys(event: KeyboardEvent) {
    if(event.key==='Escape') { setOpen(false); trigger.current?.focus(); event.preventDefault() }
    if(!open||!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return
    event.preventDefault()
    const items=[...(content.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')??[])]
    const current=items.indexOf(document.activeElement as HTMLElement)
    const index=event.key==='Home'? 0:event.key==='End'? items.length-1:(current+(event.key==='ArrowDown'? 1:-1)+items.length)%items.length
    items[index]?.focus()
  }
  return <div ref={root} className={'dropdown '+className} onKeyDown={keys} onBlur={event => { if(!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type="button" className="dropdown-trigger" aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} onKeyDown={event => { if(!open&&event.key==='ArrowDown') { event.preventDefault(); setOpen(true) } }}>{label}</button>
    {open&&<div ref={content} id={id} role="menu" className="dropdown-content" aria-label={ariaLabel} onClick={event => { if((event.target as HTMLElement).closest('[role="menuitem"]')) { setOpen(false); trigger.current?.focus() } }}>{children}</div>}
  </div>
}
