import type { Course,CourseStatus } from '../../types/Course'
import { courseTone,date } from '../../lib/format'
import { Link } from '../../lib/router'
import { Icon } from '../../components/ui/Icon'

const labels: Record<CourseStatus,string>={ draft: 'Borrador',published: 'Publicado',archived: 'Archivado' }
export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return <span className={'badge badge-'+status}>
    <span />
    {labels[status]}
  </span>
}
export function CourseCard({ course,enrolled=false,membership }: { course: Course; enrolled?: boolean; membership?: 'enrolled'|'available'|'unknown' }) {
  return <article className={'course-card tone-'+courseTone(course.courseId)}>
    <Link href={'/app/courses/'+encodeURIComponent(course.courseId)} className="course-card-link">
      <div className="course-card-top">
        <span className="course-symbol course-monogram" aria-hidden="true">{course.title.trim().slice(0,1).toLocaleUpperCase('es')}</span>
        <div className="course-card-art" aria-hidden="true"><span /><span /></div>
        <CourseStatusBadge status={course.status} />
      </div>
      <div className="course-card-copy">
      <span className="course-code">{course.courseId}</span>
      <h3>{course.title}</h3>
      <p>{course.description||'Un espacio listo para nuevas ideas y aprendizajes.'}</p>
      <div className="course-card-bottom">
        <span>{enrolled||membership==='enrolled'? 'Estás matriculado':membership==='available'? 'Disponible para matricularte':membership==='unknown'? 'Ver disponibilidad':date(course.createdAt)}</span>
        <span className="round-arrow">
          <Icon name="arrow" size={18} />
        </span>
      </div>
      </div>
    </Link>
  </article>
}
