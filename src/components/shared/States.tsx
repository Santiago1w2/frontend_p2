import { Component } from 'react'
import type { ReactNode } from 'react'
import { ApiError,errorMessage } from '../../api/errors'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { Button } from '../ui/Controls'
import { Brand } from './Brand'

export function EmptyState({ title,description,action,icon='book' }: { title: string; description: string; action?: ReactNode; icon?: IconName }) {
  return <div className="empty-state">
    <div className="empty-icon">
      <Icon name={icon} size={28} />
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>
}
export function ErrorState({ error,retry,compact=false }: { error: unknown; retry?: () => void; compact?: boolean }) {
  if(!error) return null
  return <div className={'error-state '+(compact? 'compact':'')} role="alert">
    <Icon name="alert" />
    <div>
      <strong>No pudimos completar la solicitud</strong>
      <p>{errorMessage(error)}</p>
      {error instanceof ApiError&&error.requestId&&<details>
        <summary>Referencia del error</summary>
        <code>{error.code} · {error.requestId}</code>
        <p>{error.message}</p>
      </details>}
      {retry&&<Button variant="secondary" onClick={retry}>Reintentar</Button>}
    </div>
  </div>
}
export function LoadingSkeleton({ rows=3 }: { rows?: number }) {
  return <div className="skeleton-group" role="status" aria-label="Cargando contenido">
    <span className="sr-only">Cargando contenido</span>
    {Array.from({ length: rows },(_,index) => <div className="skeleton" key={index}>
      <span />
      <span />
    </div>)}
  </div>
}
export function PaginationControls({ count,hasMore,loading,onMore,error }: { count: number; hasMore: boolean; loading: boolean; onMore: () => void; error?: unknown }) {
  return <>
    <ErrorState error={error} compact />
    <div className="pagination">
      <span>{count} registros cargados · {hasMore? 'hay más resultados':'fin de la lista'}</span>
      {hasMore&&<Button variant="secondary" loading={loading} onClick={onMore}>Cargar más <Icon name="down" size={16} /></Button>}
    </div>
  </>
}
export class ErrorBoundary extends Component<{ children: ReactNode },{ failed: boolean }> {
  state={ failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { document.title='Aurion · Error de interfaz' }
  render() {
    if(this.state.failed) return <main className="recovery">
      <Brand />
      <EmptyState icon="alert" title="Esta página necesita un nuevo comienzo" description="Ocurrió un error de interfaz. Recarga para recuperar tu espacio." action={<Button onClick={() => window.location.reload()}>Recargar aplicación</Button>} />
    </main>
    return this.props.children
  }
}
