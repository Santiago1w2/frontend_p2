import { useRef,useState } from 'react'
import type { FormEvent } from 'react'
import type { Evaluation,EvaluationInput,EvaluationStatus,Question } from '../../types/lms'
import { validateEvaluation } from '../../lib/validation'
import type { FieldErrors } from '../../lib/validation'
import { evaluationCreate,evaluationPatch,evaluationFind } from '../../services/EvaluationService'
import { useScope,useCourse } from '../../hooks/useCourses'
import { useQuery } from '../../hooks/useQuery'
import { useAction } from '../../hooks/useAction'
import { useUser } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { canManage } from '../../lib/permissions'
import { queryCache } from '../../lib/queryCache'
import { Link } from '../../lib/router'
import { navigate } from '../../lib/navigation'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button,FormField,ConfirmDialog } from '../../components/ui/Controls'
import { EmptyState,ErrorState,LoadingSkeleton } from '../../components/shared/States'
import { Icon } from '../../components/ui/Icon'
import { EvaluationQuestionEditor } from './QuestionEditor'

function localDateTime(value?: string) {
  if(!value||Number.isNaN(Date.parse(value))) return ''
  const parsed=new Date(value)
  return new Date(parsed.getTime()-parsed.getTimezoneOffset()*60000).toISOString().slice(0,16)
}
function Editor({ courseId,evaluation }: { courseId: string; evaluation?: Evaluation }) {
  const scope=useScope()
  const notify=useToast()
  const form=useRef<HTMLFormElement>(null)
  const [title,setTitle]=useState(evaluation?.title??'')
  const [deadline,setDeadline]=useState(localDateTime(evaluation?.fechaLimite))
  const [questions,setQuestions]=useState<Question[]>(evaluation?.questions??[])
  const [status,setStatus]=useState<EvaluationStatus>(evaluation?.status??'draft')
  const [errors,setErrors]=useState<FieldErrors>({})
  const [confirm,setConfirm]=useState<EvaluationStatus|null>(null)
  const action=useAction(async (target: EvaluationStatus) => {
    const input: EvaluationInput={ courseId,title: title.trim(),questions,...(deadline? { fechaLimite: new Date(deadline).toISOString() }:{}) }
    return evaluation? evaluationPatch(evaluation.evaluationId,{ title: input.title,questions,fechaLimite: input.fechaLimite??'',status: target }):evaluationCreate(input)
  },result => {
    queryCache.invalidate([...scope,'evaluations',courseId])
    queryCache.update([...scope,'evaluation',result.evaluationId],() => result)
    notify(result.status==='published'? 'Evaluación publicada.':result.status==='closed'? 'Evaluación cerrada.':'Borrador guardado.')
    navigate('/app/evaluations/'+encodeURIComponent(result.evaluationId))
  })
  function save(target: EvaluationStatus) {
    const input={ courseId,title,questions,fechaLimite: deadline }
    const nextErrors=validateEvaluation(input,target)
    setErrors(nextErrors)
    if(Object.keys(nextErrors).length) {
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"], .field-error')?.focus())
      return
    }
    if(evaluation&&target!==evaluation.status&&(target==='published'||target==='closed')) setConfirm(target)
    else void action.run(target)
  }
  function submit(event: FormEvent) { event.preventDefault(); save(evaluation? status:'draft') }
  return <>
    <PageHeader eyebrow="DISEÑA BUENAS PREGUNTAS" title={evaluation? 'Editar evaluación':'Aprender empieza por preguntar.'} description="Guarda un borrador a tu ritmo. Para publicar, incluye al menos tres preguntas con sus respuestas correctas." />
    <form ref={form} className="evaluation-editor stack" onSubmit={submit}>
      <section className="form-panel stack">
        <ErrorState error={action.error} compact />
        <FormField id="evaluation-title" label="Título" error={errors.title}>
          <input id="evaluation-title" value={title} onChange={event => setTitle(event.target.value)} required disabled={action.pending} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title? 'evaluation-title-error':undefined} />
        </FormField>
        <div className="form-grid">
          <FormField id="evaluation-deadline" label="Fecha límite (opcional)" hint="Se guarda en UTC. Se muestra en la zona horaria de tu dispositivo." error={errors.fechaLimite}>
            <input id="evaluation-deadline" type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} disabled={action.pending} />
          </FormField>
          {evaluation&&<FormField id="evaluation-status" label="Estado">
            <select id="evaluation-status" value={status} onChange={event => setStatus(event.target.value as EvaluationStatus)} disabled={action.pending}>
              <option value="draft">Borrador</option>
              <option value="published">Publicada</option>
              <option value="closed">Cerrada</option>
            </select>
          </FormField>}
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>El mapa de preguntas</h2>
          <p className="muted">{questions.length} preguntas · Sin guardar hasta confirmar</p>
        </div>
        <Button variant="secondary" disabled={action.pending} onClick={() => setQuestions([...questions,{ questionId: 'Q-'+crypto.randomUUID(),text: '',options: ['',''] }])}><Icon name="plus" size={17} />Añadir pregunta</Button>
      </div>
      {errors.questions&&<p className="field-error" role="alert" tabIndex={-1}>{errors.questions}</p>}
      {questions.map((question,index) => <EvaluationQuestionEditor key={question.questionId} question={question} index={index} errors={errors} disabled={action.pending} onRemove={() => setQuestions(questions.filter((_,current) => current!==index))} onChange={next => setQuestions(questions.map((current,currentIndex) => currentIndex===index? next:current))} />)}
      {!questions.length&&<EmptyState icon="clipboard" title="La primera pregunta está por llegar" description="Añade una pregunta y construye sus opciones de respuesta." action={<Button variant="secondary" onClick={() => setQuestions([{ questionId: 'Q-'+crypto.randomUUID(),text: '',options: ['',''] }])}>Añadir primera pregunta</Button>} />}
      <div className="editor-savebar">
        <Link className="button button-secondary" href={evaluation? '/app/evaluations/'+encodeURIComponent(evaluation.evaluationId):'/app/courses/'+encodeURIComponent(courseId)+'/evaluations'}>Cancelar</Link>
        <div className="button-group">
          <Button type="submit" loading={action.pending}>{evaluation? 'Guardar cambios':'Guardar borrador'}</Button>
          {evaluation&&status!=='published'&&<Button variant="secondary" disabled={action.pending} onClick={() => { setStatus('published'); save('published') }}>Publicar evaluación <Icon name="arrow" size={16} /></Button>}
        </div>
      </div>
    </form>
    <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm==='published'? '¿Publicar esta evaluación?':'¿Cerrar esta evaluación?'} description={confirm==='published'? 'Será visible para los estudiantes matriculados en el curso.':'Dejará de estar visible para estudiantes. Sus respuestas locales no se guardan en el servidor.'} pending={action.pending} error={<ErrorState error={action.error} compact />} onConfirm={() => { if(confirm) void action.run(confirm) }} />
  </>
}
export default function EvaluationEditor({ courseId,evaluationId }: { courseId?: string; evaluationId?: string }) {
  const scope=useScope()
  const user=useUser()
  const query=useQuery([...scope,'evaluation',evaluationId],signal => evaluationFind(evaluationId??'',signal),Boolean(evaluationId))
  const course=useCourse(courseId??'')
  if(evaluationId) {
    if(query.isLoading) return <LoadingSkeleton />
    if(query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
    if(!query.data) return null
    if(!canManage(user,query.data.teacherId)) return <EmptyState icon="shield" title="Esta evaluación tiene otro responsable" description="Solo el autor o un administrador pueden editarla." />
    return <Editor evaluation={query.data} courseId={query.data.courseId} />
  }
  if(course.isLoading) return <LoadingSkeleton />
  if(course.error) return <ErrorState error={course.error} retry={() => void course.refetch()} />
  if(!course.data) return null
  if(!canManage(user,course.data.teacherId)) return <EmptyState icon="shield" title="No tienes permiso de creación en este curso" description="Selecciona uno de tus cursos." />
  return <Editor courseId={course.data.courseId} />
}
