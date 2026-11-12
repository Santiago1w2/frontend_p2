import { useState } from 'react'
import type { FormEvent } from 'react'
import { enrollmentList,enrollmentCreate } from '../../services/EnrollmentService'
import type { EnrollmentFilter } from '../../services/EnrollmentService'
import { useScope } from '../../hooks/useCourses'
import { usePaged } from '../../hooks/useQuery'
import { useAction } from '../../hooks/useAction'
import { useUser } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { queryCache } from '../../lib/queryCache'
import { date } from '../../lib/format'
import { Link } from '../../lib/router'
import { ApiError } from '../../api/errors'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button,Dialog,FormField } from '../../components/ui/Controls'
import { EmptyState,ErrorState,LoadingSkeleton,PaginationControls } from '../../components/shared/States'
import { Icon } from '../../components/ui/Icon'

function EnrollStudent({ close,initialCourse,initialStudent }: { close: () => void; initialCourse?: string; initialStudent?: string }) {
  const scope=useScope()
  const notify=useToast()
  const [courseId,setCourseId]=useState(initialCourse??'')
  const [studentId,setStudentId]=useState(initialStudent??'')
  const action=useAction(enrollmentCreate,() => { queryCache.invalidate([...scope,'enrollments']); notify('Matrícula confirmada. El estudiante ya tiene acceso al curso.'); close() })
  return <Dialog open onClose={close} title="Abrir una nueva oportunidad" busy={action.pending}>
    <form className="stack" onSubmit={event => { event.preventDefault(); void action.run({ courseId: courseId.trim(),studentId: studentId.trim() }) }}>
      <p className="muted">Matricula a un estudiante activo en un curso publicado de tu campus.</p>
      <ErrorState error={action.error} compact />
      {action.error instanceof ApiError&&action.error.code==='CONFLICT'&&<p className="field-error">El estudiante ya está matriculado en este curso.</p>}
      <FormField id="enroll-course" label="ID del curso">
        <input id="enroll-course" required value={courseId} onChange={event => setCourseId(event.target.value)} disabled={action.pending} />
      </FormField>
      <FormField id="enroll-student" label="ID del estudiante">
        <input id="enroll-student" required value={studentId} onChange={event => setStudentId(event.target.value)} disabled={action.pending} />
      </FormField>
      <div className="form-actions">
        <Button variant="secondary" onClick={close} disabled={action.pending}>Cancelar</Button>
        <Button type="submit" loading={action.pending}>Confirmar matrícula</Button>
      </div>
    </form>
  </Dialog>
}
export default function EnrollmentsPage() {
  const scope=useScope()
  const user=useUser()
  const params=new URLSearchParams(window.location.search)
  const initialCourse=params.get('courseId')??''
  const initialStudent=params.get('studentId')??''
  const [mode,setMode]=useState<'courseId'|'studentId'>(initialStudent? 'studentId':'courseId')
  const [input,setInput]=useState(initialCourse||initialStudent)
  const [filter,setFilter]=useState<EnrollmentFilter|null>(initialCourse? { courseId: initialCourse }:initialStudent? { studentId: initialStudent }:null)
  const [open,setOpen]=useState(false)
  const query=usePaged([...scope,'enrollments',filter],(nextToken,signal) => enrollmentList({ ...(filter??{ courseId: '' }),nextToken,limit: 20 },signal),Boolean(filter))
  function submit(event: FormEvent) { event.preventDefault(); if(input.trim()) setFilter(mode==='courseId'? { courseId: input.trim() }:{ studentId: input.trim() }) }
  return <>
    <PageHeader eyebrow="CONECTA PERSONAS CON OPORTUNIDADES" title="Matrículas" description="Consulta por curso o estudiante. Cada matrícula confirmada representa un acceso real." action={user.role==='tenant_admin'&&<Button onClick={() => setOpen(true)}><Icon name="plus" size={18} />Matricular estudiante</Button>} />
    <form className="filter-form" onSubmit={submit}>
      <label>
        <span>Consultar por</span>
        <select value={mode} onChange={event => setMode(event.target.value as 'courseId'|'studentId')}>
          <option value="courseId">Curso</option>
          <option value="studentId">Estudiante</option>
        </select>
      </label>
      <label className="filter-value">
        <span>{mode==='courseId'? 'ID del curso':'ID del estudiante'}</span>
        <input value={input} onChange={event => setInput(event.target.value)} required />
      </label>
      <Button type="submit" variant="secondary"><Icon name="search" size={17} />Consultar</Button>
    </form>
    {!filter? <EmptyState icon="shield" title="Empieza por un curso o una persona" description="Selecciona un filtro para consultar matrículas. No se realizan búsquedas globales." />:<>
      <p className="scope-note">Filtro activo: {filter.courseId? 'curso '+filter.courseId:'estudiante '+filter.studentId}.</p>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      {query.isLoading? <LoadingSkeleton />:query.items.length? <div className="table-wrap" role="region" aria-label="Matrículas filtradas" tabIndex={0}>
        <table>
          <caption className="sr-only">Matrículas con el filtro seleccionado</caption>
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Curso</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {query.items.map(item => <tr key={item.enrollmentId}>
              <td>
                {user.role==='tenant_admin'? <Link href={'/app/users/'+encodeURIComponent(item.studentId)}>{item.studentId}</Link>:item.studentId}
              </td>
              <td>
                <Link href={'/app/courses/'+encodeURIComponent(item.courseId)}>{item.courseId}</Link>
              </td>
              <td>
                <span className="badge badge-published">{item.status==='active'? 'Activa':item.status}</span>
              </td>
              <td className="muted">{date(item.createdAt)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>:!query.error&&<EmptyState icon="users" title="Sin matrículas en esta consulta" description="Verifica el identificador o crea una matrícula si el estudiante ya tiene cuenta." />}
      <PaginationControls count={query.items.length} hasMore={query.hasMore} loading={query.loadingMore} onMore={() => void query.loadMore()} error={query.moreError} />
    </>}
    {open&&<EnrollStudent close={() => setOpen(false)} initialCourse={filter?.courseId} initialStudent={filter?.studentId} />}
  </>
}
