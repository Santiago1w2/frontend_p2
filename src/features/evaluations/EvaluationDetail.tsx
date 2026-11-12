import { useState } from 'react'
import { useUser } from '../../context/AuthContext'
import { useScope } from '../../hooks/useCourses'
import { useQuery } from '../../hooks/useQuery'
import { evaluationFind } from '../../services/EvaluationService'
import { date } from '../../lib/format'
import { canManage } from '../../lib/permissions'
import { Link } from '../../lib/router'
import { PageHeader } from '../../components/shared/PageHeader'
import { ErrorState,LoadingSkeleton } from '../../components/shared/States'
import { Button } from '../../components/ui/Controls'
import { Icon } from '../../components/ui/Icon'
import { EvaluationStatusBadge } from './EvaluationList'

export default function EvaluationDetail({ evaluationId }: { evaluationId: string }) {
  const scope=useScope()
  const user=useUser()
  const query=useQuery([...scope,'evaluation',evaluationId],signal => evaluationFind(evaluationId,signal))
  const [answers,setAnswers]=useState<Record<string,number>>({})
  if(query.isLoading) return <LoadingSkeleton />
  if(query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const evaluation=query.data
  if(!evaluation) return null
  const student=user.role==='student'
  return <>
    <PageHeader eyebrow="UN MOMENTO PARA PENSAR" title={evaluation.title} description={evaluation.questions.length+' preguntas · '+(evaluation.fechaLimite? 'Fecha límite: '+date(evaluation.fechaLimite,{ dateStyle: 'medium',timeStyle: 'short' }):'Sin fecha límite')} action={canManage(user,evaluation.teacherId)&&<Link className="button button-primary" href={'/app/evaluations/'+encodeURIComponent(evaluationId)+'/edit'}><Icon name="edit" size={17} />Editar evaluación</Link>} />
    <div className="evaluation-meta">
      <EvaluationStatusBadge status={evaluation.status} />
      <Link href={'/app/courses/'+encodeURIComponent(evaluation.courseId)+'/evaluations'}>Volver al curso <Icon name="arrow" size={15} /></Link>
    </div>
    {student&&<div className="notice practice-notice">
      <Icon name="book" size={23} />
      <div>
        <strong>Práctica local · No evaluada</strong>
        <p>Puedes seleccionar opciones para estudiar. No se envían respuestas, no se guardan intentos y no se generan calificaciones. Las respuestas correctas no están disponibles para estudiantes.</p>
      </div>
    </div>}
    <div className="question-reader stack">
      {evaluation.questions.map((question,index) => <fieldset key={question.questionId} className="question-read">
        <legend>
          <span>{String(index+1).padStart(2,'0')}</span>
          {question.text||'Pregunta sin enunciado'}
        </legend>
        <div className="read-options">
          {question.options.map((option,optionIndex) => <label key={optionIndex} className={'read-option '+(student? answers[question.questionId]===optionIndex? 'selected':'':question.correctIndex===optionIndex? 'correct':'')}>
            {student? <input type="radio" name={question.questionId} checked={answers[question.questionId]===optionIndex} onChange={() => setAnswers({ ...answers,[question.questionId]: optionIndex })} />:<span className="option-letter">{String.fromCharCode(65+optionIndex)}</span>}
            <span>{option||'Opción sin texto'}</span>
            {!student&&question.correctIndex===optionIndex&&<span className="correct-label"><Icon name="check" size={16} />Correcta</span>}
          </label>)}
        </div>
      </fieldset>)}
    </div>
    {student&&Object.keys(answers).length>0&&<Button variant="secondary" onClick={() => setAnswers({})}>Limpiar mis selecciones locales</Button>}
    {!student&&!evaluation.questions.length&&<div className="notice">Este borrador todavía no contiene preguntas.</div>}
  </>
}
