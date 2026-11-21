import { useUser } from '../../context/AuthContext'
import { useScope } from '../../hooks/useCourses'
import { useQuery } from '../../hooks/useQuery'
import { evaluationFind } from '../../services/EvaluationService'
import { date } from '../../lib/format'
import { canManage } from '../../lib/permissions'
import { Link } from '../../lib/router'
import { PageHeader } from '../../components/shared/PageHeader'
import { ErrorState,LoadingSkeleton } from '../../components/shared/States'
import { ApiError } from '../../api/errors'
import StudentQuiz from './StudentQuiz'
import { EvaluationResultLookup, EvaluationResultsPanel } from './EvaluationResults'
import { Icon } from '../../components/ui/Icon'
import { EvaluationStatusBadge } from './EvaluationList'

export default function EvaluationDetail({ evaluationId }: { evaluationId: string }) {
  const scope=useScope()
  const user=useUser()
  const query=useQuery([...scope,'evaluation',evaluationId],signal => evaluationFind(evaluationId,signal))
  if(query.isLoading) return <LoadingSkeleton />
  if(query.error) return <div className="stack">
    <ErrorState error={query.error} retry={() => void query.refetch()} />
    {user.role==='student'&&query.error instanceof ApiError&&query.error.code==='NOT_FOUND'&&<><p>La evaluación puede estar cerrada. Si ya entregaste, puedes consultar tu calificación.</p><EvaluationResultLookup evaluationId={evaluationId} /></>}
  </div>
  const evaluation=query.data
  if(!evaluation) return null
  const student=user.role==='student'
  return <>
    <PageHeader eyebrow="UN MOMENTO PARA PENSAR" title={evaluation.title} description={evaluation.questions.length+' preguntas · '+(evaluation.fechaLimite? 'Fecha límite: '+date(evaluation.fechaLimite,{ dateStyle: 'medium',timeStyle: 'short' }):'Sin fecha límite')} action={canManage(user,evaluation.teacherId)&&<Link className="button button-primary" href={'/app/evaluations/'+encodeURIComponent(evaluationId)+'/edit'}><Icon name="edit" size={17} />Editar evaluación</Link>} />
    <div className="evaluation-meta">
      <EvaluationStatusBadge status={evaluation.status} />
      <Link href={'/app/courses/'+encodeURIComponent(evaluation.courseId)+'/evaluations'}>Volver al curso <Icon name="arrow" size={15} /></Link>
    </div>
    <p className="scope-note">ID de la evaluación: {evaluationId}</p>
    {student?<StudentQuiz key={evaluationId} evaluation={evaluation} />:<div className="question-reader stack">
      {evaluation.questions.map((question,index) => <fieldset key={question.questionId} className="question-read">
        <legend>
          <span>{String(index+1).padStart(2,'0')}</span>
          {question.text||'Pregunta sin enunciado'}
        </legend>
        <div className="read-options">
          {question.options.map((option,optionIndex) => <div key={optionIndex} className={'read-option '+(question.correctIndex===optionIndex? 'correct':'')}>
            <span className="option-letter">{String.fromCharCode(65+optionIndex)}</span>
            <span>{option||'Opción sin texto'}</span>
            {!student&&question.correctIndex===optionIndex&&<span className="correct-label"><Icon name="check" size={16} />Correcta</span>}
          </div>)}
        </div>
      </fieldset>)}
    </div>}
    {!student&&canManage(user,evaluation.teacherId)&&<EvaluationResultsPanel evaluationId={evaluationId} courseId={evaluation.courseId} />}
    {!student&&!evaluation.questions.length&&<div className="notice">Este borrador todavía no contiene preguntas.</div>}
  </>
}
