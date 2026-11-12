import { useState } from 'react'
import { preference,savePreference } from '../../lib/session'
import { Icon } from '../ui/Icon'
export function ThemeToggle() {
  const [dark,setDark]=useState(() => preference('theme',window.matchMedia('(prefers-color-scheme: dark)').matches? 'dark':'light')==='dark')
  return <button className="icon-button theme-toggle" type="button" aria-label={dark? 'Activar modo claro':'Activar modo oscuro'} title={dark? 'Modo claro':'Modo oscuro'} onClick={() => { const next=!dark; setDark(next); document.documentElement.dataset.theme=next? 'dark':'light'; savePreference('theme',next? 'dark':'light') }}>
    <Icon name={dark? 'sun':'moon'} size={19} />
  </button>
}
