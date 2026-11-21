import { useEffect, useState } from 'react'
import type { Evaluation, EvaluationResult } from '../../types/lms'
import { useUser } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useScope } from '../../hooks/useCourses'
import { useQuery } from '../../hooks/useQuery'
import { useAction } from '../../hooks/useAction'
import { evaluationResultOrNull, submitQuizSafely } from '../../services/EvaluationService'
import { ApiError } from '../../api/errors'
import { acceptsSubmission, quizAnswers } from '../../lib/evaluations'
import { queryCache } from '../../lib/queryCache'
import { session } from '../../lib/session'
import { Link } from '../../lib/router'
import { ErrorState, LoadingSkeleton } from '../../components/shared/States'
import { Button, ConfirmDialog } from '../../components/ui/Controls'
import { ResultCard } from './EvaluationResults'

export default function StudentQuiz({ evaluation }: { evaluation: Evaluation }) {
  const user = useUser()
  const scope = useScope()
  const notify = useToast()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [confirm, setConfirm] = useState(false)
  const [validationError, setValidationError] = useState<unknown>(null)
  const [now, setNow] = useState(() => Date.now())
  const resultKey = [...scope, 'evaluation-result', evaluation.evaluationId, user.userId]
  const result = useQuery(resultKey, signal => evaluationResultOrNull(evaluation.evaluationId, undefined, signal))
  useEffect(() => {
    if (!evaluation.fechaLimite) return
    const timer = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [evaluation.fechaLimite])
  const action = useAction(async (selections: Record<string, number>) => {
    if (!acceptsSubmission(evaluation, Date.now())) throw new ApiError('EVALUATION_CLOSED', 'La evaluación ya no admite entregas.')
    const orderedAnswers = quizAnswers(evaluation.questions, selections)
    const saved = await submitQuizSafely(evaluation.evaluationId, { answers: orderedAnswers }, session.signal())
    return { ...saved, answers: 'answers' in saved ? saved.answers : orderedAnswers, studentId: user.userId, tenantId: user.tenantId } satisfies EvaluationResult
  }, saved => {
    queryCache.update<EvaluationResult | null>(resultKey, () => saved)
    setConfirm(false)
    notify('Entrega registrada. Tu calificación está disponible.')
  })
  const saved = result.data
  const uncertain = action.error instanceof ApiError && action.error.code === 'SUBMISSION_UNCERTAIN'
  const available = acceptsSubmission(evaluation, now)
  const locked = Boolean(saved) || result.status !== 'success' || result.fetching || action.pending || uncertain || !available
  function requestSubmit() {
    setValidationError(null)
    action.reset()
    try {
      if (!acceptsSubmission(evaluation, Date.now())) throw new ApiError('EVALUATION_CLOSED', 'La fecha límite ya pasó.')
      quizAnswers(evaluation.questions, answers)
      setConfirm(true)
    } catch (error) { setValidationError(error) }
  }
  async function refreshResult() {
    await result.refetch()
    const snapshot = queryCache.entry<EvaluationResult | null>(resultKey).snapshot
    if (!snapshot.error) action.reset()
  }
  return <div className="stack">
    {result.isLoading && <LoadingSkeleton rows={2} />}
    <ErrorState error={result.error} retry={() => void refreshResult()} />
    {saved ? <ResultCard result={saved} /> : <div className="notice"><strong>Evaluación con calificación</strong><p>Responde todas las preguntas. Al confirmar, tus respuestas se guardan y el servidor calcula tu nota. Se admite una sola entrega.</p></div>}
    {!saved && !available && <div className="notice" role="status">La evaluación está cerrada o su fecha límite ya pasó. Puedes consultar una entrega anterior.</div>}
    <ErrorState error={action.error} compact />
    <ErrorState error={validationError} compact />
    <div className="question-reader stack">
      {evaluation.questions.map((question, index) => <fieldset key={question.questionId} className="question-read" disabled={locked}>
        <legend><span>{String(index + 1).padStart(2, '0')}</span>{question.text || 'Pregunta sin enunciado'}</legend>
        <div className="read-options">
          {question.options.map((option, optionIndex) => {
            const selected = (saved ? saved.answers[index] : answers[question.questionId]) === optionIndex
            return <label key={optionIndex} className={'read-option ' + (selected ? 'selected' : '')}>
              <input type="radio" name={'answer-' + index} checked={selected} onChange={() => { setAnswers(previous => ({ ...previous, [question.questionId]: optionIndex })); setValidationError(null) }} />
              <span>{option || 'Opción sin texto'}</span>
            </label>
          })}
        </div>
      </fieldset>)}
    </div>
    {!saved && <div className="button-group">
      <Button onClick={requestSubmit} loading={action.pending} disabled={locked || !evaluation.questions.length}>Enviar evaluación</Button>
      <Button variant="secondary" disabled={locked || !Object.keys(answers).length} onClick={() => { setAnswers({}); setValidationError(null) }}>Limpiar selecciones</Button>
    </div>}
    <div className="button-group">
      <Button variant="secondary" loading={result.fetching} disabled={action.pending} onClick={() => void refreshResult()}>Consultar mi resultado</Button>
      <Link href={'/app/evaluations/' + encodeURIComponent(evaluation.evaluationId) + '/result'}>Enlace de mi calificación</Link>
    </div>
    <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="¿Enviar tus respuestas?" description="La entrega se guardará y no podrás cambiar las respuestas después. El servidor calculará tu calificación." pending={action.pending} onConfirm={() => { if (!uncertain) void action.run(answers).then(() => setConfirm(false)) }} />
  </div>
}
