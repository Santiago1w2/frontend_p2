import type { EvaluationInput, EvaluationStatus } from '../types/lms'
export type FieldErrors = Record<string, string>
export function validateEvaluation(input: EvaluationInput, status: EvaluationStatus): FieldErrors {
  const errors: FieldErrors = {}
  if (!input.title.trim()) errors.title = 'Escribe un título.'
  if (input.fechaLimite && Number.isNaN(Date.parse(input.fechaLimite))) errors.fechaLimite = 'Introduce una fecha válida.'
  if (status !== 'published') return errors
  if (input.questions.length < 3) errors.questions = 'Necesitas al menos 3 preguntas para publicar.'
  const ids = new Set<string>()
  input.questions.forEach((question, questionIndex) => {
    const prefix = 'questions.' + questionIndex
    if (!question.text.trim()) errors[prefix + '.text'] = 'Escribe el enunciado.'
    if (ids.has(question.questionId)) errors.questions = 'Cada pregunta debe tener un identificador único.'
    ids.add(question.questionId)
    if (question.options.length < 2) errors[prefix + '.options'] = 'Añade al menos dos opciones.'
    question.options.forEach((option, optionIndex) => {
      if (!option.trim()) errors[prefix + '.options.' + optionIndex] = 'Escribe una opción.'
    })
    if (!Number.isInteger(question.correctIndex) || question.correctIndex === undefined || question.correctIndex < 0 || question.correctIndex >= question.options.length) errors[prefix + '.correctIndex'] = 'Selecciona una respuesta correcta.'
  })
  return errors
}
