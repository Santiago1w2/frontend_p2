import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './styles/components.css'
import './styles/responsive.css'
import { preference } from './lib/session'

document.documentElement.dataset.theme=preference('theme',window.matchMedia('(prefers-color-scheme: dark)').matches? 'dark':'light')

createRoot(document.getElementById('root')!).render(
  <StrictMode>

    <App />

  </StrictMode>,
)
