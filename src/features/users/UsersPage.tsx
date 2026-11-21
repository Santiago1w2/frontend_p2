import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePaged,useQuery } from '../../hooks/useQuery'
import { usePagedSearch } from '../../hooks/usePagedSearch'
import { useExactSearch } from '../../hooks/useExactSearch'
import { exactEntityId } from '../../lib/entitySearch'
import { useScope } from '../../hooks/useCourses'
import { useAction } from '../../hooks/useAction'
import { userListByRole,userCreate,userFindId } from '../../services/AuthService'
import type { UserRoleFilter } from '../../services/AuthService'
import type { Role,UserCreateRequest } from '../../types/User'
import { roleLabels } from '../../lib/permissions'
import { date } from '../../lib/format'
import { queryCache } from '../../lib/queryCache'
import { Link } from '../../lib/router'
import { ApiError } from '../../api/errors'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState,ErrorState,LoadingSkeleton,PaginationControls } from '../../components/shared/States'
import { Button,Dialog,FormField,SearchInput } from '../../components/ui/Controls'
import { Icon } from '../../components/ui/Icon'

function CreateUser({ close }: { close: () => void }) {
  const scope=useScope()
  const notify=useToast()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [role,setRole]=useState<Role>('student')
  const action=useAction((data: UserCreateRequest) => userCreate(data),() => { setPassword(''); queryCache.invalidate([...scope,'users']); notify('Usuario creado en tu campus.'); close() })
  function submit(event: FormEvent) { event.preventDefault(); void action.run({ email: email.trim().toLowerCase(),password,role }) }
  return <Dialog open onClose={close} title="Una nueva persona en el campus" busy={action.pending}>
    <form className="stack" onSubmit={submit}>
      <ErrorState error={action.error} compact />
      {action.error instanceof ApiError&&action.error.code==='CONFLICT'&&<p className="field-error">Ese correo ya está registrado. La dirección debe ser única entre todos los campus.</p>}
      <FormField id="user-email" label="Correo electrónico">
        <input id="user-email" type="email" autoComplete="off" required value={email} onChange={event => setEmail(event.target.value)} disabled={action.pending} />
      </FormField>
      <FormField id="user-password" label="Contraseña inicial" hint="Compártela de forma segura con la persona. Nunca se almacena en el frontend.">
        <input id="user-password" type="password" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={action.pending} />
      </FormField>
      <FormField id="user-role" label="Rol">
        <select id="user-role" value={role} onChange={event => setRole(event.target.value as Role)} disabled={action.pending}>
          {Object.entries(roleLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </FormField>
      <div className="form-actions">
        <Button variant="secondary" onClick={close} disabled={action.pending}>Cancelar</Button>
        <Button type="submit" loading={action.pending}>Crear usuario</Button>
      </div>
    </form>
  </Dialog>
}
export default function UsersPage() {
  const scope=useScope()
  const [search,setSearch]=useState('')
  const exactId=exactEntityId(search,'user')
  const [role,setRole]=useState<UserRoleFilter>('all')
  const query=usePaged([...scope,'users',role],(nextToken,signal) => userListByRole(role,{ nextToken,limit: 20 },signal),!exactId)
  const [open,setOpen]=useState(false)
  const exact=useExactSearch([...scope,'users','exact',exactId],exactId,userFindId)
  const paged=usePagedSearch(query,search,(user,text) => (user.email+' '+user.userId).toLowerCase().includes(text),!exactId)
  const items=exactId? exact.data&&(role==='all'||exact.data.role===role)? [exact.data]:[]:paged.items
  const searchQuery=exactId??paged.searchQuery
  const seeking=!exactId&&paged.seeking
  const searching=exactId? exact.isLoading:paged.isLoading
  const error=exactId? exact.error:query.error
  const moreError=exactId? null:query.moreError
  return <>
    <PageHeader eyebrow="LAS PERSONAS HACEN EL CAMPUS" title="Tu comunidad." description="Gestiona los accesos de estudiantes, docentes y administradores." action={<Button onClick={() => setOpen(true)}><Icon name="plus" size={18} />Crear usuario</Button>} />
    <div className="toolbar">
      <SearchInput value={search} onChange={setSearch} label="Buscar usuarios por correo o ID" />
      <label className="inline-select">
        <span className="sr-only">Filtrar usuarios por rol</span>
        <select value={role} onChange={event => setRole(event.target.value as UserRoleFilter)}>
          <option value="all">Todos los roles</option>
          {Object.entries(roleLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    <p className="scope-note">{exactId? 'Consulta por ID completo: '+exactId+'.':'La búsqueda por correo o ID y el filtro de rol buscan coincidencias en los usuarios de tu campus.'}</p>
    <ErrorState error={error} retry={() => void (exactId? exact.refetch():query.refetch())} />
    {seeking&&!query.isLoading&&<p className="scope-note" role="status">Buscando usuarios que coincidan…</p>}
    {searching? <LoadingSkeleton />:items.length? <div className="table-wrap" role="region" aria-label="Usuarios de tu campus" tabIndex={0}>
      <table>
        <caption className="sr-only">Usuarios cargados de tu campus</caption>
        <thead>
          <tr>
            <th>Persona</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Desde</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(user => <tr key={user.userId}>
            <td>
              <Link className="person-cell" href={'/app/users/'+encodeURIComponent(user.userId)}>
                <span className="avatar">{user.email.slice(0,2).toUpperCase()}</span>
                <span>
                  <strong>{user.email}</strong>
                  <small>{user.userId}</small>
                </span>
              </Link>
            </td>
            <td>
              <span className={'role-pill role-'+user.role}>{roleLabels[user.role]}</span>
            </td>
            <td>
              <span className="status-text">
                <i />
                {user.status==='active'? 'Activo':user.status}
              </span>
            </td>
            <td className="muted">{date(user.createdAt)}</td>
            <td>
              <Link className="icon-button" href={'/app/users/'+encodeURIComponent(user.userId)} aria-label={'Ver detalle de '+user.email}>
                <Icon name="arrow" size={17} />
              </Link>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>:!error&&!moreError&&<EmptyState icon="users" title="Sin personas en esta vista" description={searchQuery? 'Prueba otro correo, ID o rol.':role==='all'? 'Todavía no hay usuarios en tu campus.':'No hay usuarios con este rol en tu campus.'} />}
    <PaginationControls count={exactId? items.length:query.items.length} hasMore={!exactId&&query.hasMore} loading={!exactId&&query.loadingMore} onMore={() => void query.loadMore()} error={moreError} />
    {open&&<CreateUser close={() => setOpen(false)} />}
  </>
}
export function UserDetail({ userId }: { userId: string }) {
  const scope=useScope()
  const query=useQuery([...scope,'user',userId],signal => userFindId(userId,signal))
  if(query.isLoading) return <LoadingSkeleton />
  if(query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const user=query.data
  if(!user) return null
  return <>
    <PageHeader eyebrow="PERSONAS DEL CAMPUS" title={user.email.split('@')[0]} description={user.email} action={user.role==='student'&&<Link className="button button-secondary" href={'/app/enrollments?studentId='+encodeURIComponent(user.userId)}>Ver matrículas <Icon name="arrow" size={17} /></Link>} />
    <section className="form-panel">
      <dl className="detail-grid">
        {[['Identificador',user.userId],['Correo',user.email],['Rol',roleLabels[user.role]],['Estado',user.status],['Campus',user.tenantId],['Creado',date(user.createdAt)]].map(([label,value]) => <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>)}
      </dl>
      <div className="notice">La API permite crear y consultar usuarios; no ofrece edición, desactivación ni cambio de contraseña.</div>
    </section>
  </>
}
