export interface Page<T> { items: T[]; nextToken: string | null }
export interface PageParams { limit?: number; nextToken?: string }
export interface DeletionResult { deleted: boolean }
export interface Enrollment {
  enrollmentId: string
  courseId: string
  studentId: string
  status: string
  createdAt: string
}
export const allowedMimeTypes = ['application/pdf', 'video/mp4', 'image/jpeg', 'image/png', 'application/zip', 'text/plain'] as const
export type MaterialMime = (typeof allowedMimeTypes)[number]
export interface Material {
  contentId: string
  courseId: string
  uploadedBy: string
  title: string
  mimeType: MaterialMime
  sizeBytes: number
  uploadStatus: 'confirmed'
  createdAt: string
  confirmedAt?: string
}
export type EvaluationStatus = 'draft' | 'published' | 'closed'
export interface Question { questionId: string; text: string; options: string[]; correctIndex?: number }
export interface EvaluationInput { courseId: string; title: string; questions: Question[]; fechaLimite?: string }
export interface Evaluation extends EvaluationInput {
  evaluationId: string
  tenantId: string
  teacherId: string
  status: EvaluationStatus
  createdAt: string
  updatedAt?: string
}
export type EvaluationPatch = Partial<Omit<EvaluationInput, 'courseId'>> & { status?: EvaluationStatus }
export interface QuizSubmission { answers: number[] }
export interface QuizSubmissionResult {
  evaluationId: string
  score: number
  correctAnswers: number
  totalQuestions: number
  submittedAt: string
}
export interface EvaluationResult extends QuizSubmissionResult {
  studentId: string
  tenantId: string
  answers: number[]
}
