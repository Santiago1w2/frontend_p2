import { useState } from 'react'
import type { FormEvent } from 'react'
import { enrollmentList,enrollmentCreate,enrollmentDelete } from '../../services/EnrollmentService'
import { clearDeletedEnrollment } from '../../lib/deletions'
import { DeleteButton } from '../../components/shared/DeleteButton'
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
import { enrollmentIdError,validateEnrollment } from '../../lib/validation'
import type { FieldErrors } from '../../lib/validation'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button,Dialog,FormField } from '../../components/ui/Controls'
import { EmptyState,ErrorState,LoadingSkeleton,PaginationControls } from '../../components/shared/States'
import { Icon } from '../../components/ui/Icon'

function EnrollStudent({ close,initialCourse,initialStudent }: { close: () => void; initialCourse?: string; initialStudent?: string }) {
  const scope=useScope()
  const user=useUser()
  const notify=useToast()
  const [courseId,setCourseId]=useState(initialCourse??'')
  const [studentId,setStudentId]=useState(initialStudent??'')
  const [errors,setErrors]=useState<FieldErrors>({})
  const action=useAction(enrollmentCreate,() => { queryCache.invalidate([...scope,'enrollments']); notify('Matrícula confirmada. El estudiante ya tiene acceso al curso.'); close() })
  function submit(event: FormEvent) {
    event.preventDefault()
    action.reset()
    const data={ courseId: courseId.trim(),studentId: studentId.trim() }
    const validation=validateEnrollment(data)
    setErrors(validation)
    if(Object.keys(validation).length) return
    void action.run(data)
  }
  return <Dialog open onClose={close} title="Abrir una nueva oportunidad" busy={action.pending}>
    <form className="stack" onSubmit={submit}>
      <p className="muted">Matricula a un estudiante activo en un curso publicado de tu campus: {user.tenantId}. El estudiante y el curso deben pertenecer a este mismo campus.</p>
      <ErrorState error={action.error} compact />
      {action.error instanceof ApiError&&action.error.code==='CONFLICT'&&<p className="field-error">El estudiante ya está matriculado en este curso.</p>}
      <FormField id="enroll-course" label="ID del curso" hint="Copia el courseId que empieza por CRS-, sin COURSE#. El curso debe estar publicado." error={errors.courseId}>
        <input id="enroll-course" required value={courseId} onChange={event => { setCourseId(event.target.value); setErrors(previous => ({ ...previous,courseId: '' })); action.reset() }} disabled={action.pending} placeholder="CRS-…" aria-invalid={Boolean(errors.courseId)} aria-describedby={'enroll-course-hint'+(errors.courseId? ' enroll-course-error':'')} />
      </FormField>
      <FormField id="enroll-student" label="ID del estudiante" hint="Copia el userId que empieza por USR- desde Usuarios. Usa el ID, sin USER#, en lugar del correo." error={errors.studentId}>
        <input id="enroll-student" required value={studentId} onChange={event => { setStudentId(event.target.value); setErrors(previous => ({ ...previous,studentId: '' })); action.reset() }} disabled={action.pending} placeholder="USR-…" aria-invalid={Boolean(errors.studentId)} aria-describedby={'enroll-student-hint'+(errors.studentId? ' enroll-student-error':'')} />
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
  const [inputError,setInputError]=useState<string>()
  const [filter,setFilter]=useState<EnrollmentFilter|null>(initialCourse? { courseId: initialCourse }:initialStudent? { studentId: initialStudent }:null)
  const [open,setOpen]=useState(false)
  const query=usePaged([...scope,'enrollments',filter],(nextToken,signal) => enrollmentList({ ...(filter??{ courseId: '' }),nextToken,limit: 20 },signal),Boolean(filter))
  function submit(event: FormEvent) {
    event.preventDefault()
    const error=enrollmentIdError(input,mode)
    setInputError(error)
    if(!error) {
      const next=mode==='courseId'? { courseId: input.trim() }:{ studentId: input.trim() }
      if(JSON.stringify(next)===JSON.stringify(filter)) void query.refetch()
      else setFilter(next)
    }
  }
  return <>
    <PageHeader eyebrow="CONECTA PERSONAS CON OPORTUNIDADES" title="Matrículas" description="Consulta por curso o estudiante. Cada matrícula confirmada representa un acceso real." action={user.role==='tenant_admin'&&<Button onClick={() => setOpen(true)}><Icon name="plus" size={18} />Matricular estudiante</Button>} />
    <form className="filter-form" onSubmit={submit}>
      <label>
        <span>Consultar por</span>
        <select value={mode} onChange={event => { setMode(event.target.value as 'courseId'|'studentId'); setInputError(undefined) }}>
          <option value="courseId">Curso</option>
          <option value="studentId">Estudiante</option>
        </select>
      </label>
      <label className="filter-value">
        <span>{mode==='courseId'? 'ID del curso':'ID del estudiante'}</span>
        <input value={input} onChange={event => { setInput(event.target.value); setInputError(undefined) }} required placeholder={mode==='courseId'? 'CRS-…':'USR-…'} aria-invalid={Boolean(inputError)} aria-describedby={'enrollment-filter-hint'+(inputError? ' enrollment-filter-error':'')} />
      </label>
      <Button type="submit" variant="secondary"><Icon name="search" size={17} />Consultar</Button>
    </form>
    <p className="scope-note" id="enrollment-filter-hint">Consulta con el ID del curso o del estudiante, sin prefijos de DynamoDB. El correo no es un ID. Campus actual: {user.tenantId}.</p>
    {inputError&&<p className="field-error" id="enrollment-filter-error" role="alert">{inputError}</p>}
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
              {user.role==='tenant_admin'&&<th>Acciones</th>}
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
              {user.role==='tenant_admin'&&<td><DeleteButton label="Eliminar matrícula" description={'Se retirará la matrícula del estudiante '+item.studentId+' en el curso '+item.courseId+'. Perderá el acceso que depende de esa matrícula. Sus entregas y calificaciones existentes se conservan.'} remove={() => enrollmentDelete({ courseId: item.courseId,studentId: item.studentId })} onDeleted={() => clearDeletedEnrollment(scope,item.courseId)} /></td>}
            </tr>)}
          </tbody>
        </table>
      </div>:!query.error&&<EmptyState icon="users" title="Sin matrículas en esta consulta" description="Verifica el identificador o crea una matrícula si el estudiante ya tiene cuenta." />}
      <PaginationControls count={query.items.length} hasMore={query.hasMore} loading={query.loadingMore} onMore={() => void query.loadMore()} error={query.moreError} />
    </>}
    {open&&<EnrollStudent close={() => setOpen(false)} initialCourse={filter?.courseId} initialStudent={filter?.studentId} />}
  </>
}
