import { useState } from 'react'
import { useUser } from '../../context/AuthContext'
import { useScope } from '../../hooks/useCourses'
import { useQuery } from '../../hooks/useQuery'
import { evaluationList } from '../../services/EvaluationService'
import { Link } from '../../lib/router'
import { date } from '../../lib/format'
import { Icon } from '../../components/ui/Icon'
import { EmptyState,ErrorState,LoadingSkeleton } from '../../components/shared/States'
import type { EvaluationStatus } from '../../types/lms'

const statusLabels: Record<EvaluationStatus,string>={ draft: 'Borrador',published: 'Publicada',closed: 'Cerrada' }
export function EvaluationStatusBadge({ status }: { status: EvaluationStatus }) { return <span className={'badge badge-'+status}>{statusLabels[status]}</span> }
export default function EvaluationList({ courseId,editable=false }: { courseId: string; editable?: boolean }) {
  const scope=useScope()
  const user=useUser()
  const [status,setStatus]=useState('all')
  const query=useQuery([...scope,'evaluations',courseId],signal => evaluationList(courseId,signal))
  const items=query.data?.items.filter(item => (user.role!=='student'||item.status==='published')&&(status==='all'||status===item.status))??[]
  return <section className="stack">
    <div className="section-heading">
      <div>
        <h2>Evaluaciones del curso</h2>
        <p className="muted">{user.role==='student'? 'Responde las evaluaciones publicadas y consulta tu calificación.':'Diseña preguntas y consulta las calificaciones de tus estudiantes.'}</p>
      </div>
      {editable&&<Link className="button button-secondary" href={'/app/courses/'+encodeURIComponent(courseId)+'/evaluations/new'}><Icon name="plus" size={17} />Crear evaluación</Link>}
    </div>
    {user.role!=='student'&&<label className="inline-select self-start">
      <span className="sr-only">Filtrar estado de evaluaciones</span>
      <select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">Todos los estados</option>
        <option value="draft">Borradores</option>
        <option value="published">Publicadas</option>
        <option value="closed">Cerradas</option>
      </select>
    </label>}
    <ErrorState error={query.error} retry={() => void query.refetch()} />
    {query.isLoading? <LoadingSkeleton />:items.length? <div className="evaluation-list">
      {items.map(item => <Link className="evaluation-row" href={'/app/evaluations/'+encodeURIComponent(item.evaluationId)} key={item.evaluationId}>
        <span className="evaluation-icon">
          <Icon name="clipboard" size={23} />
        </span>
        <div className="evaluation-copy">
          <h3>{item.title}</h3>
          <p>{item.questions.length} preguntas <span>·</span> {item.fechaLimite? 'Hasta el '+date(item.fechaLimite):'Sin fecha límite'}</p>
        </div>
        <EvaluationStatusBadge status={item.status} />
        <Icon name="arrow" size={17} />
      </Link>)}
    </div>:!query.error&&<EmptyState icon="clipboard" title="Aquí empiezan las buenas preguntas" description={user.role==='student'? 'Tu docente todavía no ha publicado evaluaciones para este curso.':'Crea una evaluación o cambia el filtro para ver otros estados.'} action={editable? <Link className="button button-secondary" href={'/app/courses/'+encodeURIComponent(courseId)+'/evaluations/new'}>Crear evaluación</Link>:undefined} />}
  </section>
}
