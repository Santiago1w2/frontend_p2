import { API_COURSE } from '../api/api'
import type { Course, CourseCreateRequest, CoursePatchRequest } from '../types/Course'
import type { Page, PageParams } from '../types/lms'
export const courseCreate = (data: CourseCreateRequest) => API_COURSE.post<Course>('/courses', data)
export const courseList = (params: PageParams & { teacherId?: string } = {}, signal?: AbortSignal) => API_COURSE.get<Page<Course>>('/courses', { params, signal })
export const courseFindId = (id: string, signal?: AbortSignal) => API_COURSE.get<Course>('/courses/' + encodeURIComponent(id), { signal })
export const patchCourse = (id: string, data: CoursePatchRequest) => API_COURSE.patch<Course>('/courses/' + encodeURIComponent(id), data)
