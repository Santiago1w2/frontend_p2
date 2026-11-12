import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { session } from '../../lib/session'
import { navigate } from '../../lib/navigation'
import type { Role } from '../../types/User'
import { hasRole } from '../../lib/permissions'
import { EmptyState,ErrorState,LoadingSkeleton } from './States'
import { Button } from '../ui/Controls'
import { Brand } from './Brand'
export function Redirect({ to }: { to: string }) {
  useEffect(() => { navigate(to,true) },[to])
  return null
}
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth=useAuth()
  if(auth.checking) return <main className="recovery">
    <Brand />
    <p className="eyebrow">ABRIENDO TU CAMPUS AURION</p>
    <LoadingSkeleton rows={2} />
  </main>
  if(!auth.user&&auth.error&&session.token()) return <main className="recovery">
    <ErrorState error={auth.error} retry={auth.retry} />
    <Button variant="ghost" onClick={() => void auth.logout()}>Volver al inicio de sesión</Button>
  </main>
  if(!auth.user) return <Redirect to="/login" />
  return children
}
export function RoleGuard({ roles,children }: { roles: Role[]; children: ReactNode }) {
  const { user }=useAuth()
  if(!user||!hasRole(user.role,roles)) return <EmptyState icon="shield" title="Este espacio tiene otro permiso" description="Tu rol no tiene acceso a esta sección." action={<Button onClick={() => navigate('/app')}>Volver al inicio</Button>} />
  return children
}
