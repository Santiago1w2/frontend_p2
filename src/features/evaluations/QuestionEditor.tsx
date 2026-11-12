import type { Question } from '../../types/lms'
import type { FieldErrors } from '../../lib/validation'
import { Button,FormField } from '../../components/ui/Controls'
import { Icon } from '../../components/ui/Icon'
export function EvaluationQuestionEditor({ question,index,errors,onChange,onRemove,disabled }: { question: Question; index: number; errors: FieldErrors; onChange: (question: Question) => void; onRemove: () => void; disabled: boolean }) {
  const prefix='questions.'+index
  const id='question-'+question.questionId
  function removeOption(optionIndex: number) {
    const correctIndex=question.correctIndex===optionIndex? undefined:question.correctIndex!==undefined&&question.correctIndex>optionIndex? question.correctIndex-1:question.correctIndex
    onChange({ ...question,options: question.options.filter((_,current) => current!==optionIndex),correctIndex })
  }
  return <section className="question-editor">
    <div className="question-heading">
      <span className="question-number">{String(index+1).padStart(2,'0')}</span>
      <h3>Pregunta {index+1}</h3>
      <Button variant="ghost" className="icon-button" aria-label={'Quitar pregunta '+(index+1)} onClick={onRemove} disabled={disabled}>
        <Icon name="trash" size={17} />
      </Button>
    </div>
    <FormField id={id} label="Enunciado" error={errors[prefix+'.text']}>
      <textarea id={id} rows={3} value={question.text} onChange={event => onChange({ ...question,text: event.target.value })} disabled={disabled} aria-invalid={Boolean(errors[prefix+'.text'])} aria-describedby={errors[prefix+'.text']? id+'-error':undefined} />
    </FormField>
    <fieldset className="options-editor" disabled={disabled}>
      <legend>Opciones de respuesta <span>Marca la correcta</span></legend>
      {question.options.map((option,optionIndex) => <div key={optionIndex} className="option-edit-wrap">
        <div className={'option-edit '+(question.correctIndex===optionIndex? 'correct':'')}>
          <input type="radio" name={id+'-correct'} checked={question.correctIndex===optionIndex} onChange={() => onChange({ ...question,correctIndex: optionIndex })} aria-label={'Marcar opción '+(optionIndex+1)+' como correcta'} />
          <label className="sr-only" htmlFor={id+'-option-'+optionIndex}>Opción {optionIndex+1}</label>
          <input id={id+'-option-'+optionIndex} value={option} onChange={event => onChange({ ...question,options: question.options.map((value,current) => current===optionIndex? event.target.value:value) })} placeholder={'Opción '+(optionIndex+1)} aria-invalid={Boolean(errors[prefix+'.options.'+optionIndex])} aria-describedby={errors[prefix+'.options.'+optionIndex]? id+'-option-error-'+optionIndex:undefined} />
          <Button variant="ghost" className="icon-button" onClick={() => removeOption(optionIndex)} aria-label={'Quitar opción '+(optionIndex+1)} disabled={disabled}>
            <Icon name="close" size={15} />
          </Button>
        </div>
        {errors[prefix+'.options.'+optionIndex]&&<p id={id+'-option-error-'+optionIndex} className="field-error">{errors[prefix+'.options.'+optionIndex]}</p>}
      </div>)}
      {errors[prefix+'.options']&&<p className="field-error" role="alert">{errors[prefix+'.options']}</p>}
      {errors[prefix+'.correctIndex']&&<p className="field-error" role="alert">{errors[prefix+'.correctIndex']}</p>}
      <Button variant="ghost" onClick={() => onChange({ ...question,options: [...question.options,''] })} disabled={disabled}><Icon name="plus" size={16} />Añadir opción</Button>
    </fieldset>
  </section>
}
