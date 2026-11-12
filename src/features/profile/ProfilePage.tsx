import { useAuth,useUser } from '../../context/AuthContext'
import { date } from '../../lib/format'
import { roleLabels } from '../../lib/permissions'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button } from '../../components/ui/Controls'
import { Icon } from '../../components/ui/Icon'
import { BrandMark } from '../../components/shared/Brand'
export default function ProfilePage() {
  const user=useUser()
  const auth=useAuth()
  return <>
    <PageHeader eyebrow="TU IDENTIDAD EN EL CAMPUS" title="Un espacio muy tuyo." description="Tu información de cuenta, tal como la registra tu universidad." />
    <section className="profile-panel">
      <div className="profile-banner">
        <span className="avatar avatar-large">{user.email.slice(0,2).toUpperCase()}</span>
        <div>
          <h2>{user.email.split('@')[0]}</h2>
          <p>{roleLabels[user.role]}</p>
        </div>
        <BrandMark className="profile-brand-mark" />
      </div>
      <dl className="detail-grid">
        {[['Correo electrónico',user.email],['Identificador',user.userId],['Campus',user.tenantId],['Rol',roleLabels[user.role]],['Estado',user.status==='active'? 'Activo':user.status],['Fecha de creación',date(user.createdAt)]].map(([label,value]) => <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>)}
      </dl>
      <div className="notice">Los cambios de perfil y contraseña no están disponibles en la API actual. Contacta al administrador de tu campus.</div>
      <Button variant="secondary" loading={auth.busy} onClick={() => void auth.logout()}><Icon name="logout" size={18} />Cerrar sesión</Button>
    </section>
  </>
}
