import { useEffect,useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth,useUser } from '../../context/AuthContext'
import { Link } from '../../lib/router'
import { useLocation } from '../../lib/navigation'
import { preference,savePreference } from '../../lib/session'
import { roleLabels } from '../../lib/permissions'
import { date } from '../../lib/format'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { Dialog,Button } from '../ui/Controls'
import { Dropdown } from '../ui/Dropdown'
import { ThemeToggle } from './ThemeToggle'
import { Brand,BrandMark } from '../shared/Brand'

interface NavItem { href: string; label: string; icon: IconName; exact?: boolean }
function UserMenu() {
  const user=useUser()
  const { logout,busy }=useAuth()
  return <Dropdown className="user-menu" ariaLabel="Menú de tu cuenta" label={<>
    <span className="avatar">{user.email.slice(0,2).toUpperCase()}</span>
    <span className="profile-copy">
      <strong>{user.email.split('@')[0]}</strong>
      <small>{roleLabels[user.role]}</small>
    </span>
    <Icon name="down" size={15} />
  </>}>
    <div className="menu-label">{user.email}</div>
    <Link role="menuitem" href="/app/profile"><Icon name="user" size={17} />Mi perfil</Link>
    <div className="menu-divider" />
    <button role="menuitem" disabled={busy} onClick={() => void logout()}>
      <Icon name="logout" size={17} />
      {busy? 'Cerrando sesión…':'Cerrar sesión'}
    </button>
  </Dropdown>
}
function AppSidebar({ collapsed,toggle,mobile,close }: { collapsed: boolean; toggle: () => void; mobile?: boolean; close?: () => void }) {
  const user=useUser()
  const location=useLocation().split('?')[0]
  const items: NavItem[]=[{ href: '/app',label: 'Inicio',icon: 'home',exact: true }]
  if(user.role==='student') items.push({ href: '/app/courses',label: 'Explorar cursos',icon: 'compass',exact: true },{ href: '/app/my-courses',label: 'Mis cursos',icon: 'book' })
  else if(user.role==='teacher') items.push({ href: '/app/my-courses',label: 'Mis cursos',icon: 'book' },{ href: '/app/courses/new',label: 'Crear curso',icon: 'plus',exact: true })
  else items.push({ href: '/app/users',label: 'Usuarios',icon: 'users' },{ href: '/app/courses',label: 'Cursos',icon: 'book' },{ href: '/app/enrollments',label: 'Matrículas',icon: 'shield' })
  items.push({ href: '/app/evaluations',label: 'Evaluaciones',icon: 'clipboard' })
  return <div className={'sidebar-inner '+(collapsed&&!mobile? 'is-collapsed':'')}>
    <div className="sidebar-brand">
      <Link href="/app" className="brand-home" aria-label="Aurion, inicio" onClick={close}><Brand inverse /></Link>
      {!mobile&&<button className="collapse-button icon-button" onClick={toggle} aria-label={collapsed? 'Expandir navegación':'Contraer navegación'} aria-expanded={!collapsed}>
        <Icon name="panel" size={17} />
      </button>}
    </div>
    <div className="campus-label">
      <span className="campus-indicator" />
      <span>Tu campus</span>
      <small>{user.tenantId.replaceAll('_',' ')}</small>
    </div>
    <div className="nav-label">TU ESPACIO</div>
    <nav className="sidebar-nav" aria-label="Navegación principal">
      {items.map(item => {
        const active=item.exact? location===item.href:location.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={close} className={'nav-link '+(active? 'active':'')} aria-current={active? 'page':undefined} data-tip={item.label} aria-label={collapsed&&!mobile? item.label:undefined}>
          <Icon name={item.icon} size={19} />
          <span>{item.label}</span>
          {active&&<i aria-hidden="true" />}
        </Link>
      })}
    </nav>
    <div className="sidebar-note">
      <BrandMark />
      <p>Grandes ideas.<br /><strong>Nuevos comienzos.</strong></p>
      <span>APRENDE. CREA. CONECTA.</span>
    </div>
    <div className="sidebar-bottom">
      <Link href="/app/profile" onClick={close} className={'nav-link '+(location==='/app/profile'? 'active':'')} data-tip="Mi perfil">
        <Icon name="user" size={19} />
        <span>Mi perfil</span>
      </Link>
      <UserMenu />
    </div>
  </div>
}
function Breadcrumbs() {
  const path=useLocation().split('?')[0]
  const names: Record<string,string>={ courses: 'Cursos','my-courses': 'Mis cursos',users: 'Usuarios',enrollments: 'Matrículas',evaluations: 'Evaluaciones',profile: 'Mi perfil',materials: 'Materiales',new: 'Crear',edit: 'Editar' }
  const segments=path.split('/').filter(Boolean).slice(1)
  return <nav aria-label="Ruta de navegación" className="breadcrumbs">
    <Link href="/app">Mi campus</Link>
    {segments.map((segment,index) => <span key={index}>
      <Icon name="chevron" size={13} />
      {index===segments.length-1? <span aria-current="page">{names[segment]??segment}</span>:<Link href={'/app/'+segments.slice(0,index+1).join('/')}>{names[segment]??segment}</Link>}
    </span>)}
  </nav>
}
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed,setCollapsed]=useState(() => preference('sidebar',window.matchMedia('(max-width: 1100px)').matches? 'collapsed':'expanded')==='collapsed')
  const [mobile,setMobile]=useState(false)
  useEffect(() => {
    const desktop=window.matchMedia('(min-width: 761px)')
    function closeOnDesktop() { if(desktop.matches) setMobile(false) }
    desktop.addEventListener('change',closeOnDesktop)
    return () => desktop.removeEventListener('change',closeOnDesktop)
  },[])
  function toggle() { setCollapsed(!collapsed); savePreference('sidebar',collapsed? 'expanded':'collapsed') }
  return <div className={'app-shell '+(collapsed? 'sidebar-collapsed':'')}>
    <a href="#main-content" className="skip-link">Saltar al contenido</a>
    <aside className="desktop-sidebar">
      <AppSidebar collapsed={collapsed} toggle={toggle} />
    </aside>
    <Dialog open={mobile} onClose={() => setMobile(false)} title="Tu campus Aurion" className="mobile-navigation">
      <AppSidebar collapsed={false} toggle={toggle} mobile close={() => setMobile(false)} />
    </Dialog>
    <div className="app-body">
      <header className="app-header">
        <Button variant="ghost" className="mobile-menu icon-button" aria-label="Abrir navegación" onClick={() => setMobile(true)}>
          <Icon name="menu" />
        </Button>
        <Breadcrumbs />
        <div className="header-tools">
          <span className="header-date">{date(new Date().toISOString(),{ weekday: 'long',day: 'numeric',month: 'long' })}</span>
          <ThemeToggle />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="main-content">{children}</main>
      <footer className="app-footer">
        <span>Aurion · Tu próximo capítulo</span>
        <span>Menos ruido. Más ideas.</span>
      </footer>
    </div>
  </div>
}
