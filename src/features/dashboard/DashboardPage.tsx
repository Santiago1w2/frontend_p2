import { useState } from 'react'
import { useUser } from '../../context/AuthContext'
import { useCourseCollection,useScope } from '../../hooks/useCourses'
import { useQuery } from '../../hooks/useQuery'
import { materialList } from '../../services/MaterialService'
import { evaluationList } from '../../services/EvaluationService'
import { roleLabels } from '../../lib/permissions'
import { Link } from '../../lib/router'
import { date,courseTone } from '../../lib/format'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState,ErrorState,LoadingSkeleton } from '../../components/shared/States'
import { Icon } from '../../components/ui/Icon'
import { CourseCard,CourseStatusBadge } from '../courses/CourseCard'
import { CampusArtwork } from '../../components/shared/CampusArtwork'
import { BrandMark } from '../../components/shared/Brand'
import type { Course } from '../../types/Course'

function CourseActivity({ course }: { course: Course }) {
  const scope=useScope()
  const user=useUser()
  const materials=useQuery([...scope,'materials',course.courseId],signal => materialList(course.courseId,signal))
  const evaluations=useQuery([...scope,'evaluations',course.courseId],signal => evaluationList(course.courseId,signal))
  const available=evaluations.data?.items.filter(item => user.role!=='student'||item.status==='published').slice(0,3)??[]
  const recent=[...(materials.data?.items??[])].sort((first,second) => (second.confirmedAt??second.createdAt).localeCompare(first.confirmedAt??first.createdAt)).slice(0,3)
  const root='/app/courses/'+encodeURIComponent(course.courseId)
  return <div className="activity-grid">
    <section className="activity-panel activity-evaluations">
      <div className="section-heading">
        <h3>Para poner en práctica</h3>
        <Icon name="clipboard" size={20} />
      </div>
      <p className="scope-note">Evaluaciones de {course.title}</p>
      <ErrorState error={evaluations.error} compact retry={() => void evaluations.refetch()} />
      {evaluations.isLoading? <LoadingSkeleton rows={2} />:available.length? <div className="activity-items">
        {available.map(item => <Link href={'/app/evaluations/'+encodeURIComponent(item.evaluationId)} key={item.evaluationId}>
          <span className="small-icon">
            <Icon name="clipboard" size={17} />
          </span>
          <div>
            <strong>{item.title}</strong>
            <small>{item.fechaLimite? 'Hasta '+date(item.fechaLimite):'Sin fecha límite'} · {item.questions.length} preguntas</small>
          </div>
          <Icon name="chevron" size={15} />
        </Link>)}
      </div>:!evaluations.error&&<p className="quiet-empty">Sin evaluaciones disponibles en este curso por ahora.</p>}
      <Link className="text-link" href={root+'/evaluations'}>Ver evaluaciones <Icon name="arrow" size={16} /></Link>
    </section>
    <section className="activity-panel activity-materials">
      <div className="section-heading">
        <h3>Sobre tu escritorio</h3>
        <Icon name="file" size={20} />
      </div>
      <p className="scope-note">Materiales recientes de {course.title}</p>
      <ErrorState error={materials.error} compact retry={() => void materials.refetch()} />
      {materials.isLoading? <LoadingSkeleton rows={2} />:recent.length? <div className="activity-items">
        {recent.map(item => <Link href={root+'/materials'} key={item.contentId}>
          <span className="small-icon">
            <Icon name="file" size={17} />
          </span>
          <div>
            <strong>{item.title}</strong>
            <small>{item.mimeType.split('/')[1].toUpperCase()} · {date(item.confirmedAt??item.createdAt)}</small>
          </div>
          <Icon name="chevron" size={15} />
        </Link>)}
      </div>:!materials.error&&<p className="quiet-empty">Tu docente aún no ha compartido materiales en este curso.</p>}
      <Link className="text-link" href={root+'/materials'}>Abrir biblioteca <Icon name="arrow" size={16} /></Link>
    </section>
  </div>
}
export default function DashboardPage() {
  const user=useUser()
  const student=user.role==='student'
  const admin=user.role==='tenant_admin'
  const collection=useCourseCollection(admin? 'all':'mine')
  const [selected,setSelected]=useState('')
  const focus=collection.items.find(course => course.courseId===selected)??collection.items[0]
  const hour=new Date().getHours()
  const greeting=hour<12? 'Buenos días':hour<19? 'Buenas tardes':'Buenas noches'
  return <div className="dashboard-page">
    <PageHeader eyebrow={greeting.toUpperCase()+', '+user.email.split('@')[0].toUpperCase()} title={student? 'Tu próximo capítulo.':admin? 'El pulso de tu campus.':'Donde nacen las ideas.'} description={student? 'Haz espacio para tus ideas. Tu próximo capítulo empieza aquí.':admin? 'Personas, cursos y oportunidades. Todo en su lugar.':'Tu espacio para enseñar, organizar e inspirar.'} action={<span className="role-indicator">
      <Icon name={admin? 'shield':student? 'book':'user'} size={16} />
      {roleLabels[user.role]}
    </span>} />
    <section className={'dashboard-hero-grid '+(focus? 'has-focus':'')} aria-label="Tu espacio de aprendizaje">
      <div className="dashboard-banner">
        <div className="banner-copy">
          <p className="eyebrow">UN LUGAR PARA LO QUE VIENE</p>
          <h2>{student? <>Haz espacio<br />para <em>tus ideas.</em></>:admin? <>Conecta personas.<br /><em>Abre posibilidades.</em></>:<>Comparte lo que sabes.<br /><em>Inspira lo que viene.</em></>}</h2>
          <p className="banner-description">{student? 'La curiosidad es un buen punto de partida.':admin? 'Tu comunidad, en un mismo lugar.':'Cada curso puede ser un nuevo comienzo.'}</p>
          <Link className="button banner-button" href={student? '/app/courses':'/app/courses/new'}>
            {student? 'Descubrir cursos':'Crear un nuevo curso'}<Icon name="arrow" size={17} />
          </Link>
        </div>
        <CampusArtwork className="hero-art" />
        <span className="banner-edition" aria-hidden="true">AURION / CREATIVE CAMPUS</span>
      </div>
      {focus&&<Link className={'hero-course tone-'+courseTone(focus.courseId)} href={'/app/courses/'+encodeURIComponent(focus.courseId)}>
        <div className="hero-course-heading">
          <span className="eyebrow">{student? 'TU CURSO, A MANO':admin? 'EN TU CAMPUS':'EN TU ESPACIO'}</span>
          <CourseStatusBadge status={focus.status} />
        </div>
        <span className="hero-course-code">{focus.courseId}</span>
        <h3>{focus.title}</h3>
        <p>{focus.description||'Abre este espacio para explorar sus materiales y evaluaciones.'}</p>
        <div className="hero-course-footer"><span>{student? 'Abrir mi curso':'Abrir curso'}</span><span className="round-arrow"><Icon name="arrow" size={19} /></span></div>
        <span className="hero-course-decoration" aria-hidden="true" />
      </Link>}
    </section>
    {admin&&<div className="admin-shortcuts">
      {[{ href: '/app/users',icon: 'users' as const,title: 'Comunidad',text: 'Personas y accesos' },{ href: '/app/enrollments',icon: 'shield' as const,title: 'Matrículas',text: 'Conecta estudiantes y cursos' },{ href: '/app/evaluations',icon: 'clipboard' as const,title: 'Evaluaciones',text: 'Consulta por curso' }].map(item => <Link href={item.href} key={item.href}>
        <Icon name={item.icon} size={22} />
        <div>
          <strong>{item.title}</strong>
          <small>{item.text}</small>
        </div>
        <Icon name="arrow" size={17} />
      </Link>)}
    </div>}
    <section className="dashboard-courses">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{student? 'TU ESPACIO DE ESTUDIO':'APRENDIZAJE EN MARCHA'}</p>
          <h2>{admin? 'Cursos de tu campus':'Tu siguiente capítulo'}</h2>
        </div>
        <Link className="text-link" href={admin? '/app/courses':'/app/my-courses'}>Ver {admin? 'cursos':'mis cursos'}<Icon name="arrow" size={16} /></Link>
      </div>
      <ErrorState error={collection.error} retry={() => void collection.refetch()} />
      {collection.isLoading? <LoadingSkeleton />:collection.items.length? <>
        <p className="scope-note">Vista rápida de {Math.min(3,collection.items.length)} cursos entre los registros cargados. {collection.hasMore? 'Hay más páginas disponibles en la lista completa.':''}</p>
        <div className="course-grid dashboard-course-grid">
          {collection.items.slice(0,3).map(course => <CourseCard key={course.courseId} course={course} enrolled={student} />)}
        </div>
      </>:!collection.error&&<EmptyState title={student? 'Hay mucho por descubrir':'Tu primer curso empieza con una idea'} description={student? 'Todavía no hay cursos disponibles entre tus matrículas cargadas. Explora el catálogo para comenzar.':'Crea un curso y empieza a construir nuevas oportunidades.'} action={<Link className="button button-primary" href={student? '/app/courses':'/app/courses/new'}>
        {student? 'Explorar cursos':'Crear un curso'}
        <Icon name="arrow" size={16} />
      </Link>} />}
      {collection.missing>0&&<div className="notice">Algunas matrículas apuntan a cursos que ya no están disponibles.</div>}
      {collection.hasMore&&<Link className="text-link dashboard-more" href={admin? '/app/courses':'/app/my-courses'}>Continuar explorando los registros de tus cursos<Icon name="arrow" size={16} /></Link>}
    </section>
    {focus&&<section className="dashboard-activity">
      <div className="section-heading">
        <div>
          <p className="eyebrow">UN POCO MÁS CERCA</p>
          <h2>En el radar</h2>
        </div>
        <label className="inline-select">
          <span className="sr-only">Curso para actividad reciente</span>
          <select value={focus.courseId} onChange={event => setSelected(event.target.value)}>
            {collection.items.map(course => <option key={course.courseId} value={course.courseId}>{course.title}</option>)}
          </select>
        </label>
      </div>
      <CourseActivity key={focus.courseId} course={focus} />
    </section>}
    <div className="dashboard-signoff">
      <span className="short-rule" />
      <p>Todo gran aprendizaje empieza con curiosidad.</p>
      <BrandMark />
    </div>
  </div>
}
