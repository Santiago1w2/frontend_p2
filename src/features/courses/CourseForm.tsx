import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Course,CourseStatus } from '../../types/Course'
import { useUser } from '../../context/AuthContext'
import { useScope,useCourse } from '../../hooks/useCourses'
import { useAction } from '../../hooks/useAction'
import { canManage } from '../../lib/permissions'
import { queryCache } from '../../lib/queryCache'
import { Link } from '../../lib/router'
import { navigate } from '../../lib/navigation'
import { courseCreate,patchCourse } from '../../services/CourseService'
import { useToast } from '../../context/ToastContext'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button,FormField,ConfirmDialog } from '../../components/ui/Controls'
import { EmptyState,ErrorState,LoadingSkeleton } from '../../components/shared/States'
import { Icon } from '../../components/ui/Icon'

function Editor({ course }: { course?: Course }) {
  const scope=useScope()
  const notify=useToast()
  const [title,setTitle]=useState(course?.title??'')
  const [description,setDescription]=useState(course?.description??'')
  const [status,setStatus]=useState<CourseStatus>(course?.status??'draft')
  const [titleError,setTitleError]=useState('')
  const [confirm,setConfirm]=useState(false)
  const action=useAction(async () => course? patchCourse(course.courseId,{ title: title.trim(),description: description.trim(),status }):courseCreate({ title: title.trim(),description: description.trim() }),result => {
    queryCache.invalidate([...scope,'courses'])
    queryCache.invalidate([...scope,'enrolled-courses'])
    queryCache.update([...scope,'course',result.courseId],() => result)
    notify(course? 'Curso actualizado.':'Tu curso está listo como borrador.')
    navigate('/app/courses/'+encodeURIComponent(result.courseId))
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if(!title.trim()) { setTitleError('Escribe un título para el curso.'); return }
    setTitleError('')
    if(course&&status==='archived'&&course.status!=='archived') setConfirm(true)
    else void action.run(undefined)
  }
  return <>
    <PageHeader eyebrow="DISEÑA EL APRENDIZAJE" title={course? 'Editar curso':'Una idea, un nuevo curso.'} description={course? 'Mantén el contenido y el estado de tu curso al día.':'Empieza con lo esencial. Podrás publicar cuando esté listo.'} />
    <form className="form-panel stack" onSubmit={submit}>
      <ErrorState error={action.error} compact />
      <FormField id="course-title" label="Título del curso" error={titleError}>
        <input id="course-title" value={title} onChange={event => setTitle(event.target.value)} required aria-invalid={Boolean(titleError)} aria-describedby={titleError? 'course-title-error':undefined} disabled={action.pending} placeholder="¿Qué vamos a aprender?" />
      </FormField>
      <FormField id="course-description" label="Descripción" hint="Cuéntales a tus estudiantes qué van a descubrir.">
        <textarea id="course-description" rows={6} value={description} onChange={event => setDescription(event.target.value)} disabled={action.pending} />
      </FormField>
      {course? <FormField id="course-status" label="Estado" hint="Publicado: aparece en el catálogo de tu campus y admite matrículas. Borrador: sigue en preparación. Archivado: no admite nuevas matrículas.">
        <select id="course-status" value={status} onChange={event => setStatus(event.target.value as CourseStatus)} disabled={action.pending}>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
      </FormField>:<div className="notice"><Icon name="file" size={18} />El curso se guardará como borrador y se asignará a tu cuenta. Para mostrarlo a estudiantes de tu campus, abre Editar curso, selecciona Estado: Publicado y guarda los cambios.</div>}
      <div className="form-actions">
        <Link className="button button-secondary" href={course? '/app/courses/'+encodeURIComponent(course.courseId):'/app/my-courses'}>Cancelar</Link>
        <Button type="submit" loading={action.pending}>
          {course? 'Guardar cambios':'Crear curso'}
          <Icon name="arrow" size={17} />
        </Button>
      </div>
    </form>
    <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="¿Archivar este curso?" description="Dejará de estar disponible para nuevas matrículas. Puedes cambiar su estado más adelante." pending={action.pending} error={<ErrorState error={action.error} compact />} onConfirm={() => void action.run(undefined)} />
  </>
}
export default function CourseForm({ courseId }: { courseId?: string }) {
  const user=useUser()
  const query=useCourse(courseId??'')
  if(!courseId) return <Editor />
  if(query.isLoading) return <LoadingSkeleton />
  if(query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  if(!query.data) return null
  if(!canManage(user,query.data.teacherId)) return <EmptyState icon="shield" title="Solo puedes editar tus propios cursos" description="Contacta al docente responsable o al administrador." />
  return <Editor course={query.data} />
}
