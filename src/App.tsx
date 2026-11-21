import { useEffect } from 'react'
import './App.css'
import AuthContextProvider from './context/AuthContextProvider'
import { ToastProvider } from './components/shared/ToastProvider'
import { ErrorBoundary,EmptyState } from './components/shared/States'
import { ProtectedRoute,Redirect,RoleGuard } from './components/shared/Guards'
import { AppShell } from './components/layout/AppShell'
import { Link } from './lib/router'
import { useLocation } from './lib/navigation'
import LoginPage from './pages/LoginPage'
import DashboardPage from './features/dashboard/DashboardPage'
import CoursesPage from './features/courses/CoursesPage'
import CourseDetail from './features/courses/CourseDetail'
import CourseForm from './features/courses/CourseForm'
import UsersPage,{ UserDetail } from './features/users/UsersPage'
import EnrollmentsPage from './features/enrollments/EnrollmentsPage'
import ProfilePage from './features/profile/ProfilePage'
import EvaluationsPage from './features/evaluations/EvaluationsPage'
import EvaluationDetail from './features/evaluations/EvaluationDetail'
import EvaluationEditor from './features/evaluations/EvaluationEditor'
import ResultsPage from './features/evaluations/EvaluationResults'

function AppRoute({ path }: { path: string }) {
  const parts=path.split('/').filter(Boolean).map(part => { try { return decodeURIComponent(part) } catch { return part } })
  const [,resource,id,action,extra]=parts
  if(extra&&!(resource==='courses'&&action==='evaluations'&&extra==='new'&&parts.length===5)) return <NotFound />
  if(parts.length===1&&parts[0]==='app') return <DashboardPage />
  if(resource==='my-courses'&&!id) return <CoursesPage mine />
  if(resource==='profile'&&!id) return <ProfilePage />
  if(resource==='results'&&!id) return <ResultsPage />
  if(resource==='users') return <RoleGuard roles={['tenant_admin']}>
    {!id? <UsersPage />:!action? <UserDetail userId={id} />:<NotFound />}
  </RoleGuard>
  if(resource==='enrollments'&&!id) return <RoleGuard roles={['tenant_admin','teacher']}>
    <EnrollmentsPage />
  </RoleGuard>
  if(resource==='courses') {
    if(!id) return <CoursesPage />
    if(id==='new'&&!action) return <RoleGuard roles={['tenant_admin','teacher']}>
      <CourseForm />
    </RoleGuard>
    if(action==='edit') return <RoleGuard roles={['tenant_admin','teacher']}>
      <CourseForm courseId={id} />
    </RoleGuard>
    if(action==='evaluations'&&extra==='new') return <RoleGuard roles={['tenant_admin','teacher']}>
      <EvaluationEditor courseId={id} />
    </RoleGuard>
    if(!action||action==='materials'||action==='evaluations') return <CourseDetail courseId={id} section={action==='materials'? 'materials':action==='evaluations'? 'evaluations':'overview'} />
  }
  if(resource==='evaluations') {
    if(!id) return <EvaluationsPage />
    if(action==='result') return <ResultsPage evaluationId={id} />
    if(action==='edit') return <RoleGuard roles={['tenant_admin','teacher']}>
      <EvaluationEditor evaluationId={id} />
    </RoleGuard>
    if(!action) return <EvaluationDetail evaluationId={id} />
  }
  return <NotFound />
}
function NotFound() { return <EmptyState icon="compass" title="Este camino todavía no existe" description="Vuelve a tu espacio para encontrar lo que buscas." action={<Link className="button button-primary" href="/app">Volver al inicio</Link>} /> }
function Router() {
  const location=useLocation()
  const path=location.split('?')[0].replace(/\/+$/,'')||'/'
  useEffect(() => { document.title='Aurion · Tu próximo capítulo'; window.scrollTo({ top: 0,behavior: 'instant' }); document.getElementById('main-content')?.focus({ preventScroll: true }) },[location])
  if(path==='/') return <Redirect to="/app" />
  if(path==='/login') return <LoginPage />
  if(path!=='/app'&&!path.startsWith('/app/')) return <NotFound />
  return <ProtectedRoute>
    <AppShell>
      <AppRoute key={location} path={path} />
    </AppShell>
  </ProtectedRoute>
}
export default function App() {
  return <ErrorBoundary>
    <AuthContextProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AuthContextProvider>
  </ErrorBoundary>
}
