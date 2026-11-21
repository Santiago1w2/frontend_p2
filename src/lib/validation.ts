import type { EvaluationInput, EvaluationStatus } from '../types/lms'
export type FieldErrors = Record<string, string>
export function enrollmentIdError(value: string, field: 'courseId' | 'studentId'): string | undefined {
  const id = value.trim()
  const student = field === 'studentId'
  const label = student ? 'estudiante' : 'curso'
  const prefix = student ? 'USR-' : 'CRS-'
  if (!id) return 'Introduce el ID del ' + label + '.'
  if (id.includes('@')) return 'Introduce el ID del ' + label + ', no un correo electrónico.'
  if (!id.startsWith(prefix) || id.length === prefix.length) return 'Copia el ID del ' + label + ' que empieza por ' + prefix + ', sin prefijos de DynamoDB.'
  return undefined
}

export function validateEnrollment(input: { courseId: string; studentId: string }): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of ['courseId', 'studentId'] as const) {
    const error = enrollmentIdError(input[field], field)
    if (error) errors[field] = error
  }
  return errors
}

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
