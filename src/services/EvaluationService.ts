import { API_EVALUATION } from '../api/api'
import type { Evaluation, EvaluationInput, EvaluationPatch } from '../types/lms'
export const evaluationList = (courseId: string, signal?: AbortSignal) => API_EVALUATION.get<{ items: Evaluation[] }>('/evaluations', { params: { courseId }, signal })
export const evaluationFind = (id: string, signal?: AbortSignal) => API_EVALUATION.get<Evaluation>('/evaluations/' + encodeURIComponent(id), { signal })
export const evaluationCreate = (data: EvaluationInput) => API_EVALUATION.post<Evaluation>('/evaluations', data)
export const evaluationPatch = (id: string, data: EvaluationPatch) => API_EVALUATION.patch<Evaluation>('/evaluations/' + encodeURIComponent(id), data)
