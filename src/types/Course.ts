export type CourseStatus = 'draft' | 'published' | 'archived'
export interface CourseCreateRequest { title: string; description: string }
export interface CoursePatchRequest extends Partial<CourseCreateRequest> { status?: CourseStatus }
export interface Course extends CourseCreateRequest {
  courseId: string
  teacherId: string
  tenantId: string
  status: CourseStatus
  createdAt: string
  updatedAt?: string
}
