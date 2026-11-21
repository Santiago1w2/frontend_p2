import { useState } from 'react'
import type { FormEvent } from 'react'
import { useUser } from '../../context/AuthContext'
import { useScope } from '../../hooks/useCourses'
import { usePaged, useQuery } from '../../hooks/useQuery'
import { evaluationFind, evaluationResultOrNull } from '../../services/EvaluationService'
import { enrollmentList } from '../../services/EnrollmentService'
import type { QuizSubmissionResult } from '../../types/lms'
import { canManage } from '../../lib/permissions'
import { enrollmentIdError } from '../../lib/validation'
import { date } from '../../lib/format'
import { queryCache } from '../../lib/queryCache'
import { Link } from '../../lib/router'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, FormField } from '../../components/ui/Controls'
import { EmptyState, ErrorState, LoadingSkeleton, PaginationControls } from '../../components/shared/States'

export function ResultCard({ result }: { result: QuizSubmissionResult }) {
  return <section className="form-panel stack quiz-result" aria-label="Calificación de la evaluación" role="status">
    <h2>Entrega registrada</h2>
    <p className="quiz-score"><strong>{result.score}%</strong></p>
    <p>{result.correctAnswers} de {result.totalQuestions} respuestas correctas</p>
    <p>Enviada el {date(result.submittedAt, { dateStyle: 'medium', timeStyle: 'short' })}</p>
    <p className="scope-note">Evaluación: {result.evaluationId}. Calificación devuelta por el servidor.</p>
  </section>
}

export function EvaluationResultLookup({ evaluationId, studentId }: { evaluationId: string; studentId?: string }) {
  const user = useUser()
  const scope = useScope()
  const teacher = user.role === 'teacher'
  const evaluation = useQuery([...scope, 'evaluation', evaluationId], signal => evaluationFind(evaluationId, signal), teacher)
  const allowed = !teacher || Boolean(evaluation.data && canManage(user, evaluation.data.teacherId))
  const enabled = allowed && (user.role === 'student' || Boolean(studentId))
  const query = useQuery([...scope, 'evaluation-result', evaluationId, user.role === 'student' ? user.userId : studentId], signal => evaluationResultOrNull(evaluationId, user.role === 'student' ? undefined : studentId, signal), enabled)
  if (teacher && evaluation.isLoading) return <LoadingSkeleton rows={2} />
  if (teacher && evaluation.error) return <ErrorState error={evaluation.error} retry={() => void evaluation.refetch()} />
  if (!allowed) return <EmptyState icon="shield" title="Esta evaluación tiene otro responsable" description="Consulta las calificaciones de tus propias evaluaciones." />
  return <div className="stack">
    {query.isLoading ? <LoadingSkeleton rows={2} /> : query.data ? <ResultCard result={query.data} /> : !query.error && query.status === 'success' ? <div className="notice">Todavía no hay una entrega registrada para esta consulta. No equivale a una nota de cero.</div> : null}
    <ErrorState error={query.error} />
    <Button variant="secondary" loading={query.fetching} disabled={!enabled} onClick={() => void query.refetch()}>Actualizar resultado</Button>
  </div>
}

export function EvaluationResultsPanel({ evaluationId, courseId }: { evaluationId: string; courseId: string }) {
  const scope = useScope()
  const [selected, setSelected] = useState('')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string>()
  const roster = usePaged([...scope, 'enrollments', 'evaluation-roster', courseId], (nextToken, signal) => enrollmentList({ courseId, nextToken, limit: 20 }, signal))
  function submit(event: FormEvent) {
    event.preventDefault()
    const invalid = enrollmentIdError(input, 'studentId')
    setError(invalid)
    if (!invalid) setSelected(input.trim())
  }
  return <section className="form-panel stack" aria-label="Resultados de estudiantes">
    <h2>Calificaciones de estudiantes</h2>
    <p className="muted">Selecciona una matrícula o consulta por el ID del estudiante.</p>
    <ErrorState error={roster.error} retry={() => void roster.refetch()} />
    {roster.isLoading ? <LoadingSkeleton rows={1} /> : <FormField id="result-student-select" label="Estudiantes del curso">
      <select id="result-student-select" value={roster.items.some(item => item.studentId === selected) ? selected : ''} onChange={event => { setSelected(event.target.value); setInput(event.target.value); setError(undefined) }}>
        <option value="">Selecciona un estudiante</option>
        {roster.items.map(item => <option key={item.enrollmentId} value={item.studentId}>{item.studentId}{item.status !== 'active' ? ' · ' + item.status : ''}</option>)}
      </select>
    </FormField>}
    <PaginationControls count={roster.items.length} hasMore={roster.hasMore} loading={roster.loadingMore} onMore={() => void roster.loadMore()} error={roster.moreError} />
    <form className="stack" onSubmit={submit}>
      <FormField id="result-student-id" label="ID del estudiante" error={error}>
        <input id="result-student-id" value={input} onChange={event => setInput(event.target.value)} placeholder="USR-…" required aria-invalid={Boolean(error)} aria-describedby={error ? 'result-student-id-error' : undefined} />
      </FormField>
      <Button type="submit" variant="secondary">Consultar calificación</Button>
    </form>
    {selected && <EvaluationResultLookup key={selected} evaluationId={evaluationId} studentId={selected} />}
  </section>
}

export default function ResultsPage({ evaluationId }: { evaluationId?: string }) {
  const user = useUser()
  const scope = useScope()
  const student = user.role === 'student'
  const initialStudentId = !student && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('studentId') ?? '' : ''
  const [id, setId] = useState(evaluationId ?? '')
  const [studentId, setStudentId] = useState(initialStudentId)
  const [lookup, setLookup] = useState<{ id: string; studentId?: string } | null>(evaluationId && (student || initialStudentId) ? { id: evaluationId, ...(!student ? { studentId: initialStudentId } : {}) } : null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  function submit(event: FormEvent) {
    event.preventDefault()
    const invalid: Record<string, string> = {}
    if (!id.trim().startsWith('EVL-') || id.trim().length <= 4) invalid.id = 'Introduce el ID completo de la evaluación que empieza por EVL-.'
    if (!student) {
      const error = enrollmentIdError(studentId, 'studentId')
      if (error) invalid.studentId = error
    }
    setErrors(invalid)
    if (!Object.keys(invalid).length) {
      queryCache.invalidate([...scope, 'evaluation-result', id.trim(), student ? user.userId : studentId.trim()])
      setLookup({ id: id.trim(), ...(!student ? { studentId: studentId.trim() } : {}) })
    }
  }
  return <>
    <PageHeader eyebrow="TU APRENDIZAJE EN NÚMEROS" title="Calificaciones" description={student ? 'Consulta tu entrega con el ID de la evaluación, incluso después de su cierre. Guarda el enlace del resultado para volver a consultarlo.' : 'Consulta una calificación por evaluación y estudiante. También puedes seleccionar estudiantes desde el detalle de la evaluación.'} />
    <form className="form-panel stack" onSubmit={submit}>
      <FormField id="result-evaluation-id" label="ID de la evaluación" error={errors.id}>
        <input id="result-evaluation-id" value={id} onChange={event => setId(event.target.value)} required placeholder="EVL-…" aria-invalid={Boolean(errors.id)} aria-describedby={errors.id ? 'result-evaluation-id-error' : undefined} />
      </FormField>
      {!student && <FormField id="lookup-student-id" label="ID del estudiante" error={errors.studentId}>
        <input id="lookup-student-id" value={studentId} onChange={event => setStudentId(event.target.value)} required placeholder="USR-…" aria-invalid={Boolean(errors.studentId)} aria-describedby={errors.studentId ? 'lookup-student-id-error' : undefined} />
      </FormField>}
      <Button type="submit">Consultar resultado</Button>
    </form>
    {lookup && <div className="stack">
      <p><Link href={'/app/evaluations/' + encodeURIComponent(lookup.id)}>Abrir evaluación</Link> · <Link href={'/app/evaluations/' + encodeURIComponent(lookup.id) + '/result' + (lookup.studentId ? '?studentId=' + encodeURIComponent(lookup.studentId) : '')}>Enlace del resultado</Link></p>
      <EvaluationResultLookup key={JSON.stringify(lookup)} evaluationId={lookup.id} studentId={lookup.studentId} />
    </div>}
  </>
}
