import { API_EVALUATION } from '../api/api'
import { ApiError } from '../api/errors'
import type { DeletionResult, Evaluation, EvaluationInput, EvaluationPatch, EvaluationResult, QuizSubmission, QuizSubmissionResult } from '../types/lms'

// Older records and Bruno requests may omit questionId or repeat it. Answers are
// positional in the API; local identities must never merge two question controls.
export function normalizeEvaluation(evaluation: Evaluation): Evaluation {
  const reserved = new Set(evaluation.questions.map(question => question.questionId).filter(Boolean))
  const used = new Set<string>()
  return { ...evaluation, questions: evaluation.questions.map((question, index) => {
    let questionId = question.questionId
    if (!questionId || used.has(questionId)) {
      questionId = 'legacy-question-' + index
      while (reserved.has(questionId) || used.has(questionId)) questionId += '-local'
    }
    used.add(questionId)
    return { ...question, questionId }
  }) }
}
export async function evaluationList(courseId: string, signal?: AbortSignal) {
  const page = await API_EVALUATION.get<{ items: Evaluation[] }>('/evaluations', { params: { courseId }, signal })
  return { ...page, items: page.items.map(normalizeEvaluation) }
}
export const evaluationFind = async (id: string, signal?: AbortSignal) => normalizeEvaluation(await API_EVALUATION.get<Evaluation>('/evaluations/' + encodeURIComponent(id), { signal }))
export const evaluationCreate = async (data: EvaluationInput) => normalizeEvaluation(await API_EVALUATION.post<Evaluation>('/evaluations', data))
export const evaluationPatch = async (id: string, data: EvaluationPatch) => normalizeEvaluation(await API_EVALUATION.patch<Evaluation>('/evaluations/' + encodeURIComponent(id), data))
export const evaluationDelete = (id: string) => API_EVALUATION.delete<DeletionResult & { evaluationId: string }>('/evaluations/' + encodeURIComponent(id))
export const evaluationSubmit = (id: string, data: QuizSubmission, signal?: AbortSignal) => API_EVALUATION.post<QuizSubmissionResult>('/evaluations/' + encodeURIComponent(id) + '/submit', data, { signal })
export const evaluationResult = (id: string, studentId?: string, signal?: AbortSignal) => API_EVALUATION.get<EvaluationResult>('/evaluations/' + encodeURIComponent(id) + '/result', { params: studentId ? { studentId } : undefined, signal })
export async function evaluationResultOrNull(id: string, studentId?: string, signal?: AbortSignal): Promise<EvaluationResult | null> {
  try { return await evaluationResult(id, studentId, signal) }
  catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return null
    throw error
  }
}

// Never repeat POST automatically: a lost response may follow a saved result.
export async function submitQuizSafely(id: string, data: QuizSubmission, signal?: AbortSignal): Promise<QuizSubmissionResult | EvaluationResult> {
  const existing = await evaluationResultOrNull(id, undefined, signal)
  if (existing) return existing
  try { return await evaluationSubmit(id, data, signal) }
  catch (error) {
    if (!(error instanceof ApiError) || !['CONFLICT', 'TIMEOUT', 'NETWORK_ERROR', 'HTTP_ERROR', 'INTERNAL_ERROR', 'INVALID_RESPONSE'].includes(error.code)) throw error
    try {
      const saved = await evaluationResultOrNull(id, undefined, signal)
      if (saved) return saved
    } catch (lookupError) {
      if (signal?.aborted || (lookupError instanceof ApiError && lookupError.code === 'SESSION_EXPIRED')) throw lookupError
    }
    throw new ApiError('SUBMISSION_UNCERTAIN', 'No pudimos confirmar la entrega. Consulta tu resultado antes de volver a enviar.', error.requestId)
  }
}
