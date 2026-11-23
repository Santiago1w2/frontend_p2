import { useUser } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useCourse,useScope } from '../../hooks/useCourses'
import { useQuery } from '../../hooks/useQuery'
import { useAction } from '../../hooks/useAction'
import { isEnrolled,enrollmentCreate } from '../../services/EnrollmentService'
import { courseDelete } from '../../services/CourseService'
import { clearDeletedCourse } from '../../lib/deletions'
import { navigate } from '../../lib/navigation'
import { DeleteButton } from '../../components/shared/DeleteButton'
import { canManage } from '../../lib/permissions'
import { queryCache } from '../../lib/queryCache'
import { date,courseTone } from '../../lib/format'
import { Link } from '../../lib/router'
import { ApiError } from '../../api/errors'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState,ErrorState,LoadingSkeleton } from '../../components/shared/States'
import { Button } from '../../components/ui/Controls'
import { Icon } from '../../components/ui/Icon'
import { CourseStatusBadge } from './CourseCard'
import MaterialsPanel from '../materials/MaterialsPanel'
import EvaluationList from '../evaluations/EvaluationList'

export default function CourseDetail({ courseId,section='overview' }: { courseId: string; section?: 'overview'|'materials'|'evaluations' }) {
  const user=useUser()
  const scope=useScope()
  const notify=useToast()
  const query=useCourse(courseId)
  const student=user.role==='student'
  const membershipKey=[...scope,'membership',courseId]
  const membership=useQuery(membershipKey,signal => isEnrolled(courseId,user.userId,signal),student&&Boolean(query.data)&&query.data?.status!=='draft')
  const enroll=useAction(async () => {
    try { return await enrollmentCreate({ courseId }) }
    catch(error) {
      if(error instanceof ApiError&&error.code==='CONFLICT') { queryCache.invalidate(membershipKey); queryCache.invalidate([...scope,'enrollments','mine']) }
      throw error
    }
  },() => {
    queryCache.update(membershipKey,() => true)
    queryCache.invalidate([...scope,'enrollments','mine'])
    queryCache.invalidate([...scope,'enrolled-courses'])
    notify('Ya estás dentro. Tu matrícula está confirmada.')
  })
  if(query.isLoading) return <LoadingSkeleton />
  if(query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const course=query.data
  if(!course) return null
  if(student&&course.status==='draft') return <EmptyState title="Este curso todavía está en preparación" description="Vuelve al catálogo para explorar cursos publicados." action={<Link className="button button-primary" href="/app/courses">Explorar cursos</Link>} />
  const editable=canManage(user,course.teacherId)
  const root='/app/courses/'+encodeURIComponent(courseId)
  const allowed=!student||membership.data===true
  return <>
    <PageHeader eyebrow={course.courseId} title={course.title} description={course.description||'Un espacio para conectar ideas y descubrir algo nuevo.'} action={editable? <Link className="button button-secondary" href={root+'/edit'}><Icon name="edit" size={17} />Editar curso</Link>:student&&membership.data===true? <span className="enrolled-label"><Icon name="check" size={17} />Estás matriculado</span>:student&&membership.status==='success'&&course.status==='published'? <Button loading={enroll.pending} onClick={() => void enroll.run(undefined)}>Matricularme <Icon name="arrow" size={17} /></Button>:undefined} />
    <div className="course-detail-meta">
      <CourseStatusBadge status={course.status} />
      <span>Creado el {date(course.createdAt)}</span>
      {editable&&<Link href={'/app/enrollments?courseId='+encodeURIComponent(courseId)}>Ver estudiantes <Icon name="arrow" size={15} /></Link>}
    </div>
    {editable&&<div className="button-group"><DeleteButton label="Eliminar curso" description={'Se eliminará '+course.title+' ('+courseId+'). Las matrículas, materiales y evaluaciones asociados se conservan. Esta acción no se puede deshacer.'} remove={() => courseDelete(courseId)} onDeleted={() => { navigate(user.role==='teacher'? '/app/my-courses':'/app/courses'); clearDeletedCourse(scope,courseId) }} /></div>}
    {editable&&course.status==='draft'&&<div className="notice">Este curso está en borrador. Para mostrarlo en el catálogo de estudiantes de tu campus, abre Editar curso, selecciona Estado: Publicado y guarda los cambios. <Link href={root+'/edit'}>Editar curso</Link></div>}
    <ErrorState error={enroll.error} compact />
    <ErrorState error={membership.error} retry={() => void membership.refetch()} />
    {student&&membership.isLoading&&<p className="scope-note" role="status">Comprobando tu matrícula…</p>}
    <nav className="course-tabs" aria-label="Secciones del curso">
      {[['overview','Acerca del curso',root],['materials','Materiales',root+'/materials'],['evaluations','Evaluaciones',root+'/evaluations']].map(([name,label,href]) => <Link key={name} href={href} className={section===name? 'active':''} aria-current={section===name? 'page':undefined}>{label}</Link>)}
    </nav>
    {section==='overview'? <div className="course-overview">
      <section className={'course-intro tone-'+courseTone(courseId)}>
        <span className="course-symbol course-monogram" aria-hidden="true">{course.title.trim().slice(0,1).toLocaleUpperCase('es')}</span>
        <span className="course-intro-art" aria-hidden="true" />
        <p className="eyebrow">ACERCA DE ESTE ESPACIO</p>
        <h2>Un curso. Muchas posibilidades.</h2>
        <p className="preserve-lines">{course.description||'El docente aún no ha añadido una descripción.'}</p>
        <div className="overview-links">
          <Link href={root+'/materials'}>Explorar materiales <Icon name="arrow" size={17} /></Link>
          <Link href={root+'/evaluations'}>Ver evaluaciones <Icon name="arrow" size={17} /></Link>
        </div>
      </section>
      <aside className="course-info">
        <h3>En este curso</h3>
        <dl>
          <div>
            <dt>Docente responsable</dt>
            <dd>{course.teacherId}</dd>
          </div>
          <div>
            <dt>Última actualización</dt>
            <dd>{date(course.updatedAt??course.createdAt)}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{course.tenantId}</dd>
          </div>
        </dl>
        {student&&!membership.isLoading&&membership.data===false&&<div className="notice">{course.status==='published'? 'Matricúlate para acceder a materiales y evaluaciones.':'Este curso está archivado y no admite nuevas matrículas.'}</div>}
      </aside>
    </div>:!allowed? membership.isLoading? <LoadingSkeleton rows={2} />:<EmptyState icon="shield" title="Este espacio es para estudiantes matriculados" description={membership.error? 'No pudimos comprobar tu acceso. Reintenta la comprobación de matrícula.':course.status==='published'? 'Confirma tu matrícula con el botón superior para acceder a este curso.':'El curso no admite nuevas matrículas.'} />:section==='materials'? <MaterialsPanel courseId={courseId} editable={editable} />:<EvaluationList courseId={courseId} editable={editable} />}
  </>
}
