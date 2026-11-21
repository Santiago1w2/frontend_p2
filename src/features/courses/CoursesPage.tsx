import { useState } from 'react'
import { useUser } from '../../context/AuthContext'
import { useCourseCollection } from '../../hooks/useCourses'
import { useScope } from '../../hooks/useCourses'
import { usePaged } from '../../hooks/useQuery'
import { usePagedSearch } from '../../hooks/usePagedSearch'
import { useExactSearch } from '../../hooks/useExactSearch'
import { exactEntityId } from '../../lib/entitySearch'
import { courseFindId } from '../../services/CourseService'
import { enrollmentList,isEnrolled } from '../../services/EnrollmentService'
import type { Course } from '../../types/Course'
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
  const [search,setSearch]=useState('')
  const exactId=exactEntityId(search,'course')
  const memberships=usePaged([...scope,'enrollments','mine'],(nextToken,signal) => enrollmentList({ studentId: user.userId,nextToken,limit: 20 },signal),user.role==='student'&&!mine&&!exactId)
  const query=useCourseCollection(mine? 'mine':'all',!exactId)
  const [status,setStatus]=useState('all')
  const [view,setView]=useState<'grid'|'list'>('grid')
  const publishedOnly=user.role==='student'&&!mine
  const enrolledIds=new Set(memberships.items.filter(item => item.status==='active').map(item => item.courseId))
  function membershipLabel(courseId: string): 'enrolled'|'available'|'unknown'|undefined {
    if(!publishedOnly) return undefined
    if(enrolledIds.has(courseId)) return 'enrolled'
    return memberships.status==='success'&&!memberships.hasMore? 'available':'unknown'
  }
  function matchesFilters(course: Course) {
    return (!publishedOnly||course.status==='published')&&(status==='all'||course.status===status)&&(!mine||user.role==='student'||course.teacherId===user.userId)
  }
  const exact=useExactSearch([...scope,'courses','exact',mine,exactId],exactId,async (id,signal) => {
    const course=await courseFindId(id,signal)
    if(mine&&user.role==='student'&&!await isEnrolled(id,user.userId,signal)) return null
    return course
  })
  const paged=usePagedSearch(query,search,(course,text) => matchesFilters(course)&&(course.title+' '+course.courseId).toLowerCase().includes(text),!exactId)
  const visible=exactId? exact.data&&matchesFilters(exact.data)? [exact.data]:[]:paged.items
  const searchQuery=exactId??paged.searchQuery
  const seeking=!exactId&&paged.seeking
  const searching=exactId? exact.isLoading:paged.isLoading
  const error=exactId? exact.error:query.error
  const moreError=exactId? null:query.moreError
  return <>
    <PageHeader eyebrow={mine? 'TU ESPACIO ACADÉMICO':'DESCUBRE ALGO NUEVO'} title={mine? 'Mis cursos':user.role==='student'? 'Tu próxima gran idea.':'Cursos del campus'} description={mine? 'Todo lo que estás construyendo, en un mismo lugar.':publishedOnly? 'Explora los cursos publicados. Abre un curso para comprobar tu matrícula y disponibilidad.':'Organiza, publica y acompaña el aprendizaje de tu campus.'} action={canCreate(user)&&<Link className="button button-primary" href="/app/courses/new"><Icon name="plus" size={18} />Crear curso</Link>} />
    <div className="toolbar">
      <SearchInput value={search} onChange={setSearch} label="Buscar cursos por nombre o ID" />
      <div className="toolbar-right">
        {!publishedOnly&&<label className="inline-select">
          <span className="sr-only">Filtrar cursos por estado</span>
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
    <p className="scope-note">{exactId? 'Consulta por ID completo: '+exactId+'.':'La búsqueda y el filtro de estado buscan coincidencias en tus cursos.'}{publishedOnly&&' Solo se muestran los cursos publicados de tu campus.'}</p>
    {!exactId&&query.missing>0&&<div className="notice">{query.missing} matrículas apuntan a cursos que ya no están disponibles.</div>}
    <ErrorState error={publishedOnly? memberships.error:null} retry={() => void memberships.refetch()} compact />
    {publishedOnly&&!exactId&&memberships.hasMore&&<div className="notice">Algunas matrículas aún no están cargadas. La disponibilidad se confirma al abrir el curso.<Button variant="ghost" loading={memberships.loadingMore} onClick={() => void memberships.loadMore()}>Comprobar más matrículas</Button></div>}
    <ErrorState error={publishedOnly? memberships.moreError:null} compact />
    <ErrorState error={error} retry={() => void (exactId? exact.refetch():query.refetch())} />
    {seeking&&!query.isLoading&&<p className="scope-note" role="status">Buscando cursos que coincidan…</p>}
    {searching? <LoadingSkeleton />:visible.length? view==='grid'? <div className="course-grid">
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
    </div>:!error&&!moreError&&<EmptyState title={searchQuery||status!=='all'? 'Sin coincidencias':mine? 'Tu próximo capítulo empieza aquí':'Todavía no hay cursos visibles'} description={searchQuery||status!=='all'? 'Prueba otro nombre, ID o estado.':mine&&user.role==='student'? 'Explora el catálogo y encuentra un curso para empezar.':'Cuando haya cursos disponibles, aparecerán en este espacio.'} action={mine&&user.role==='student'? <Link className="button button-primary" href="/app/courses">Explorar cursos <Icon name="arrow" size={16} /></Link>:canCreate(user)? <Link className="button button-primary" href="/app/courses/new">Crear un curso</Link>:undefined} />}
    <PaginationControls count={exactId? visible.length:query.loaded} hasMore={!exactId&&query.hasMore} loading={!exactId&&query.loadingMore} onMore={() => void query.loadMore()} error={moreError} />
  </>
}
