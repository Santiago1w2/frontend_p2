import { useState } from 'react'
import { useUser } from '../../context/AuthContext'
import { useCourseCollection } from '../../hooks/useCourses'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState,ErrorState,LoadingSkeleton,PaginationControls } from '../../components/shared/States'
import { canManage } from '../../lib/permissions'
import EvaluationList from './EvaluationList'
export default function EvaluationsPage() {
  const user=useUser()
  const collection=useCourseCollection(user.role==='tenant_admin'? 'all':'mine')
  const [selected,setSelected]=useState('')
  const courseId=selected||collection.items[0]?.courseId||''
  const course=collection.items.find(item => item.courseId===courseId)
  return <>
    <PageHeader eyebrow="EL CONOCIMIENTO SE CONSTRUYE" title="Buenas preguntas. Nuevas ideas." description="Elige un curso para consultar sus evaluaciones. No existe un listado global en la API." />
    <ErrorState error={collection.error} retry={() => void collection.refetch()} />
    {collection.isLoading? <LoadingSkeleton />:collection.items.length? <>
      <div className="course-selector">
        <label htmlFor="evaluation-course">Curso</label>
        <select id="evaluation-course" value={courseId} onChange={event => setSelected(event.target.value)}>
          {collection.items.map(item => <option key={item.courseId} value={item.courseId}>{item.title}</option>)}
        </select>
      </div>
      <PaginationControls count={collection.loaded} hasMore={collection.hasMore} loading={collection.loadingMore} onMore={() => void collection.loadMore()} error={collection.moreError} />
      {courseId&&<EvaluationList key={courseId} courseId={courseId} editable={Boolean(course&&canManage(user,course.teacherId))} />}
    </>:!collection.error&&<EmptyState icon="clipboard" title="Primero, un curso" description="Las evaluaciones se organizan dentro de tus cursos. Cuando tengas cursos disponibles, aparecerán aquí." />}
  </>
}
