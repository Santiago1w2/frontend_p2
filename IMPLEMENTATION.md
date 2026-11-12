# Registro de implementación · Folio

## Auditoría inicial

- El directorio no contiene .git y git status indicó que no es un repositorio Git. No se crearon commits ni ramas; no es posible reconstruir un diff previo.
- README.md era la plantilla de Vite. Se leyeron API.md y READMEP.md, además del frontend y las referencias reales en ideas/js-components y los equivalentes React.
- La aplicación solo montaba LoginPage, que hacía una llamada automática con valores incrustados y escribía la respuesta en consola. Se eliminó ese comportamiento.
- AuthContext no validaba la sesión al arrancar, tomaba el campo de token equivocado, no parseaba envelopes y no limpiaba siempre en logout. CourseService consultaba el detalle con POST en vez de GET.
- No había shell, rutas, módulos de producto ni configuración de tests. Se conserva React + TypeScript + Vite + Axios y la organización de servicios/contextos/tipos existente.
- No se modificaron .env, API.md, READMEP.md, public, los assets originales ni ideas. No se tocó ningún backend.

## Implementación

- Identidad editorial Folio, tokens semánticos light/dark, sidebar persistente, menú de cuenta con teclado, drawer modal, breadcrumbs, skeletons, errores con requestId y notificaciones.
- Login/logout/me reales, token opaco, caducidad, sincronización de sesión entre pestañas, cancelación y caché segmentada por usuario/tenant.
- Dashboards por rol sin métricas fabricadas; actividad acotada al curso seleccionado.
- Catálogo, matrícula/disponibilidad diferenciada, mis cursos paginados, detalle, creación/edición y estados sin DELETE.
- Matrículas síncronas por estudiante o administrador, consultas filtradas y manejo de conflictos sin desmatriculación.
- Usuarios con creación, detalle, búsqueda/filtros locales y nextToken, sin edición ni borrado inventados.
- Biblioteca, registro/URL/PUT S3/confirmación con progreso real y recuperación segura durante la misma vista; descarga bajo demanda sin persistir URLs.
- Evaluaciones por curso, constructor dinámico, validación de publicación, fecha local/UTC, publicación/cierre; práctica estudiantil local claramente no evaluada.
- Pruebas aisladas, HTTP real en loopback y entorno visual de fixtures separado del build de producción.

## Endpoints conectados

Todos los paths se añaden a la URL del microservicio correspondiente normalizada a /v1. Los prefijos de servicio de tests no existen en producción.

| Servicio | Métodos y paths | Implementación |
| --- | --- | --- |
| Usuarios | POST /v1/auth/login; POST /v1/auth/logout; GET /v1/me | src/services/AuthService.ts |
| Usuarios | POST /v1/users; GET /v1/users; GET /v1/users/{userId} | src/services/AuthService.ts |
| Cursos | POST /v1/courses; GET /v1/courses; GET /v1/courses/{courseId}; PATCH /v1/courses/{courseId} | src/services/CourseService.ts |
| Matrículas | POST /v1/enrollments; GET /v1/enrollments con courseId o studentId | src/services/EnrollmentService.ts |
| Contenidos | POST /v1/materials; POST /v1/materials/{contentId}/upload-url; POST /v1/materials/{contentId}/confirm | src/services/MaterialService.ts |
| Contenidos | GET /v1/materials?courseId=...; GET /v1/materials/{contentId}/download-url; PUT a la URL firmada de S3 | src/services/MaterialService.ts |
| Evaluaciones | POST /v1/evaluations; GET /v1/evaluations?courseId=...; GET /v1/evaluations/{evaluationId}; PATCH /v1/evaluations/{evaluationId} | src/services/EvaluationService.ts |

## Verificación

- npm run typecheck: correcto, con strict habilitado.
- npm run lint: correcto; se excluye ideas porque es material de referencia ajeno al producto.
- npm test: 53 pruebas correctas, sin omisiones. Incluye envelopes, errores de negocio HTTP 200, 401/403, sesiones, cancelación, logout fallido, guardas/propiedad, cursores, matrículas, validación de evaluaciones, estados de lectura, recuperación de subida S3 y diferenciación del login real frente al entorno aislado. Cuatro pruebas usan HTTP/Axios real contra un servidor exclusivo en loopback; las demás usan mocks que bloquean cualquier llamada imprevista.
- npm run build: correcto; genera dist. Los fixtures y documentación no forman parte del bundle.
- npm run test:ui: se arrancó correctamente en 127.0.0.1:4173, sustituyendo los cinco servicios solo dentro de ese proceso. Se detuvo al terminar la revisión.
- La inspección visual no pudo realizarse: el host de navegador no estuvo disponible y la automatización Windows se detuvo porque no pudo verificar la URL. No se afirma haber validado manualmente el aspecto, teclado, mobile ni dark mode en navegador.
- No se hicieron escrituras de prueba contra AWS. Un diagnóstico de login de la cuenta solicitada fue bloqueado por permisos de red del entorno (EACCES), antes de recibir respuesta del servicio. No se imprimieron contraseñas ni tokens. No se certifica conectividad, CORS, permisos ni resultados del despliegue real.

## Incidencia de acceso y entornos

- Se confirmó que el servidor del puerto 4173 ejecutaba los cinco servicios ficticios, no las APIs configuradas en .env. Se detuvo ese proceso y se arrancó el frontend real con npm run dev en el puerto 5173. Se verificó por HTTP local que carga las cinco URLs configuradas y no las sustituciones de fixtures.
- El modo isolated-preview muestra ahora un aviso explícito en el login: las cuentas reales de AWS no funcionan allí. Ese aviso no aparece en development ni production.
- Se inspeccionaron, sin modificarlos, scripts/seed_usuarios.py y services/usuarios/src/handlers.py en ../prueba-cloud. El prefijo EMAIL# pertenece a la clave de búsqueda de DynamoDB; el backend lo añade al correo recibido. No se debe introducir ese prefijo en el formulario. La UI muestra una ayuda contextual si se detecta. No se altera automáticamente una dirección de correo ni se cambia el contrato de autenticación.
- No se modificó .env ni el backend; no se cambió la contraseña ni se reinicializaron usuarios.

## Límites y pendientes reales

1. Validación visual/interactiva en un navegador disponible, incluyendo drawer, menús, formularios y contraste en ambos temas.
2. Smoke test autorizado contra AWS con los tres roles. Las pruebas aisladas y el build no lo sustituyen.
3. La API no documenta entregas, calificación, intentos, progreso, eliminación de cursos, desmatriculación ni modificación de usuarios/perfil/contraseña. No se simulan esas operaciones.
4. Los pendientes de materiales no se pueden listar ni eliminar. Un timeout sin contentId puede dejar un registro pendiente no recuperable desde esta UI. El reintento con ID solo se conserva mientras permanece montado el formulario; no se persisten archivos ni URLs firmadas.
5. Riesgo XSS inherente a persistir un token en localStorage. Se conserva la estrategia existente encapsulada y con limpieza; migrar a HttpOnly requiere soporte del backend.
6. API.md documenta controles de autorización incompletos en confirmación de materiales y PATCH de evaluaciones, y visibilidad ampliada de matrículas al filtrar por curso. El frontend restringe acciones por rol/propiedad y no expone listados de terceros a estudiantes, pero no puede corregir la autorización del servidor. No se modificó ni probó mediante explotación el backend.
7. No se añadieron las librerías opcionales porque la red rechazó su instalación. Router/caché/controles utilizan la plataforma y React; cualquier migración futura debe conservar estas pruebas y contratos.
8. El hosting debe configurar fallback SPA para enlaces profundos. No se desplegó ni se cambió hosting existente.

## Archivos existentes modificados

- .gitignore
- README.md
- package.json
- eslint.config.js
- tsconfig.app.json
- index.html
- src/App.tsx
- src/App.css
- src/index.css
- src/main.tsx
- src/api/api.ts
- src/context/AuthContext.ts
- src/context/AuthContextProvider.tsx
- src/services/AuthService.ts
- src/services/CourseService.ts
- src/types/User.ts
- src/types/Course.ts
- src/pages/LoginPage.tsx

## Archivos nuevos

- .env.example
- IMPLEMENTATION.md
- src/api/errors.ts
- src/components/layout/AppShell.tsx
- src/components/layout/ThemeToggle.tsx
- src/components/shared/Guards.tsx
- src/components/shared/PageHeader.tsx
- src/components/shared/States.tsx
- src/components/shared/ToastProvider.tsx
- src/components/ui/Controls.tsx
- src/components/ui/Dropdown.tsx
- src/components/ui/Icon.tsx
- src/context/ToastContext.ts
- src/features/courses/CourseCard.tsx
- src/features/courses/CourseDetail.tsx
- src/features/courses/CourseForm.tsx
- src/features/courses/CoursesPage.tsx
- src/features/dashboard/DashboardPage.tsx
- src/features/enrollments/EnrollmentsPage.tsx
- src/features/evaluations/EvaluationDetail.tsx
- src/features/evaluations/EvaluationEditor.tsx
- src/features/evaluations/EvaluationList.tsx
- src/features/evaluations/EvaluationsPage.tsx
- src/features/evaluations/QuestionEditor.tsx
- src/features/materials/FileUploader.tsx
- src/features/materials/MaterialsPanel.tsx
- src/features/profile/ProfilePage.tsx
- src/features/users/UsersPage.tsx
- src/hooks/useAction.ts
- src/hooks/useCourses.ts
- src/hooks/useQuery.ts
- src/lib/format.ts
- src/lib/navigation.ts
- src/lib/permissions.ts
- src/lib/queryCache.ts
- src/lib/router.tsx
- src/lib/session.ts
- src/lib/validation.ts
- src/services/EnrollmentService.ts
- src/services/EvaluationService.ts
- src/services/MaterialService.ts
- src/styles/components.css
- src/styles/responsive.css
- src/types/lms.ts
- tests/api.test.mjs
- tests/domain.test.mjs
- tests/flows.test.mjs
- tests/http.test.mjs
- tests/login.test.mjs
- tests/preview-server.mjs
- tests/register.mjs
- tests/screens.test.mjs
- tests/setup.mjs

