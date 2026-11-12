import { useState } from 'react'
import { useUser } from '../../context/AuthContext'
import { useCourseCollection } from '../../hooks/useCourses'
import { useScope } from '../../hooks/useCourses'
import { usePaged } from '../../hooks/useQuery'
import { enrollmentList } from '../../services/EnrollmentService'
import { Link } from '../../lib/router'
import { canCreate } from '../../lib/permissions'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState,ErrorState,LoadingSkeleton,PaginationControls } from '../../components/shared/States'
import { Button,SearchInput } from '../../components/ui/Controls'
import { Icon } from '../../components/ui/Icon'
import { CourseCard,CourseStatusBadge } from './CourseCard'

export default function CoursesPage({ mine=false }: { mine?: boolean }) {
  const user=useUser()
  const scope=useScope()
  const memberships=usePaged([...scope,'enrollments','mine'],(nextToken,signal) => enrollmentList({ studentId: user.userId,nextToken,limit: 20 },signal),user.role==='student'&&!mine)
  const query=useCourseCollection(mine? 'mine':'all')
  const [search,setSearch]=useState('')
  const [status,setStatus]=useState('all')
  const [view,setView]=useState<'grid'|'list'>('grid')
  const publishedOnly=user.role==='student'&&!mine
  const enrolledIds=new Set(memberships.items.filter(item => item.status==='active').map(item => item.courseId))
  function membershipLabel(courseId: string): 'enrolled'|'available'|'unknown'|undefined {
    if(!publishedOnly) return undefined
    if(enrolledIds.has(courseId)) return 'enrolled'
    return memberships.status==='success'&&!memberships.hasMore? 'available':'unknown'
  }
  const visible=query.items.filter(course => (!publishedOnly||course.status==='published')&&(status==='all'||course.status===status)&&(course.title+' '+course.courseId).toLowerCase().includes(search.toLowerCase()))
  return <>
    <PageHeader eyebrow={mine? 'TU ESPACIO ACADÉMICO':'DESCUBRE ALGO NUEVO'} title={mine? 'Mis cursos':user.role==='student'? 'Tu próxima gran idea.':'Cursos del campus'} description={mine? 'Todo lo que estás construyendo, en un mismo lugar.':publishedOnly? 'Explora los cursos publicados. Abre un curso para comprobar tu matrícula y disponibilidad.':'Organiza, publica y acompaña el aprendizaje de tu campus.'} action={canCreate(user)&&<Link className="button button-primary" href="/app/courses/new"><Icon name="plus" size={18} />Crear curso</Link>} />
    <div className="toolbar">
      <SearchInput value={search} onChange={setSearch} label="Buscar en cursos cargados" />
      <div className="toolbar-right">
        {!publishedOnly&&<label className="inline-select">
          <span className="sr-only">Filtrar estado en registros cargados</span>
          <select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
            <option value="archived">Archivados</option>
          </select>
        </label>}
        <div className="view-switch" aria-label="Presentación">
          <Button variant="ghost" className="icon-button" aria-label="Vista de tarjetas" aria-pressed={view==='grid'} onClick={() => setView('grid')}>
            <Icon name="grid" size={17} />
          </Button>
          <Button variant="ghost" className="icon-button" aria-label="Vista de lista" aria-pressed={view==='list'} onClick={() => setView('list')}>
            <Icon name="list" size={18} />
          </Button>
        </div>
      </div>
    </div>
    <p className="scope-note">La búsqueda y los filtros se aplican solo a los registros cargados.{publishedOnly&&' Los borradores y archivados no se muestran.'}</p>
    {query.missing>0&&<div className="notice">{query.missing} matrículas apuntan a cursos que ya no están disponibles.</div>}
    <ErrorState error={publishedOnly? memberships.error:null} retry={() => void memberships.refetch()} compact />
    {publishedOnly&&memberships.hasMore&&<div className="notice">Algunas matrículas aún no están cargadas. La disponibilidad se confirma al abrir el curso.<Button variant="ghost" loading={memberships.loadingMore} onClick={() => void memberships.loadMore()}>Comprobar más matrículas</Button></div>}
    <ErrorState error={publishedOnly? memberships.moreError:null} compact />
    <ErrorState error={query.error} retry={() => void query.refetch()} />
    {query.isLoading? <LoadingSkeleton />:visible.length? view==='grid'? <div className="course-grid">
      {visible.map(course => <CourseCard key={course.courseId} course={course} enrolled={mine&&user.role==='student'} membership={membershipLabel(course.courseId)} />)}
    </div>:<div className="course-list">
      {visible.map(course => <Link href={'/app/courses/'+encodeURIComponent(course.courseId)} className="course-list-row" key={course.courseId}>
        <span className="list-icon">
          <Icon name="book" />
        </span>
        <div>
          <h3>{course.title}</h3>
          <span className="muted small">{course.courseId}</span>
        </div>
        <CourseStatusBadge status={course.status} />
        {publishedOnly&&<span className="membership-label">{membershipLabel(course.courseId)==='enrolled'? 'Matriculado':membershipLabel(course.courseId)==='available'? 'Disponible':'Por comprobar'}</span>}
        <Icon name="arrow" size={18} />
      </Link>)}
    </div>:!query.error&&<EmptyState title={search||status!=='all'? 'Sin coincidencias en lo cargado':mine? 'Tu próximo capítulo empieza aquí':'Todavía no hay cursos visibles'} description={query.hasMore? 'Carga más registros para continuar explorando.':mine&&user.role==='student'? 'Explora el catálogo y encuentra un curso para empezar.':'Cuando haya cursos disponibles, aparecerán en este espacio.'} action={mine&&user.role==='student'? <Link className="button button-primary" href="/app/courses">Explorar cursos <Icon name="arrow" size={16} /></Link>:canCreate(user)? <Link className="button button-primary" href="/app/courses/new">Crear un curso</Link>:undefined} />}
    <PaginationControls count={query.loaded} hasMore={query.hasMore} loading={query.loadingMore} onMore={() => void query.loadMore()} error={query.moreError} />
  </>
}
