import type { AnchorHTMLAttributes,MouseEvent } from 'react'
import { navigate } from './navigation'
export function Link({ href,onClick,...props }: AnchorHTMLAttributes<HTMLAnchorElement>&{ href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&!props.target&&!props.download&&href.startsWith('/')&&!href.startsWith('//')) {
      event.preventDefault()
      navigate(href)
    }
  }
  return <a {...props} href={href} onClick={handleClick} />
}
