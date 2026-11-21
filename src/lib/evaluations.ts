import { ApiError } from '../api/errors'
import type { Evaluation, Question } from '../types/lms'

export function quizAnswers(questions: Question[], selections: Record<string, number>): number[] {
  if (!questions.length) throw new ApiError('SUBMISSION_INCOMPLETE', 'La evaluación no contiene preguntas.')
  return questions.map(question => {
    const answer = selections[question.questionId]
    if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) throw new ApiError('SUBMISSION_INCOMPLETE', 'Responde todas las preguntas.')
    return answer
  })
}
export function acceptsSubmission(evaluation: Evaluation, now: number): boolean {
  if (evaluation.status !== 'published') return false
  const deadline = evaluation.fechaLimite ? Date.parse(evaluation.fechaLimite) : NaN
  return Number.isNaN(deadline) || now <= deadline
}
