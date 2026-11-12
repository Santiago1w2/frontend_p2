# Folio · Frontend LMS

Continuación del frontend existente en React 19, TypeScript y Vite. Consume los cinco microservicios documentados en [API.md](API.md). No incluye ni modifica el backend.

## Ejecutar

Requiere Node.js 24.15 o superior para las pruebas (usa los hooks de módulos de Node). La aplicación usa las dependencias que ya tenía el proyecto.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

El archivo .env existente se conserva. Para otra instalación, copia .env.example y reemplaza las cinco URLs de ejemplo. No incluyas claves privadas en variables VITE_: se incorporan al JavaScript público.

| Variable existente | Servicio |
| --- | --- |
| VITE_API_V1_USER | Usuarios, login, logout y perfil |
| VITE_API_V1_COURSE | Cursos |
| VITE_API_V1_MATRICULAS | Matrículas |
| VITE_API_V1_CONTENIDOS | Materiales y URLs firmadas |
| VITE_API_V1_EVALUACIONES | Evaluaciones |

Las URLs pueden terminar en /dev o /dev/v1, con o sin barra final: el cliente normaliza la versión sin duplicarla. La ausencia de una URL produce un error visible, no una llamada accidental al servidor del frontend.

### Acceso con cuentas reales

Usa `npm run dev` y abre la dirección que imprime Vite (normalmente http://localhost:5173). Este proceso consume las URLs existentes de .env. El correo de acceso es solo la dirección de email: el prefijo `EMAIL#` que aparece en DynamoDB pertenece a la clave de búsqueda y no se introduce en el formulario.

`npm run test:ui` en el puerto 4173 es un entorno aislado: no consulta AWS ni acepta cuentas reales. Muestra un aviso explícito en el login y admite únicamente sus cuentas ficticias. Detén ese proceso antes de pasar al entorno real.

## Organización

- src/api: cliente Axios central y errores de envelope.
- src/services: contratos tipados por microservicio; conserva AuthService y CourseService.
- src/context: autenticación y notificaciones.
- src/features: dashboards, cursos, comunidad, matrículas, materiales, evaluaciones y perfil.
- src/components: shell, sidebar, navegación móvil, controles y estados compartidos.
- src/hooks y src/lib: consulta/caché, paginación, permisos, sesión, navegación y validación.
- src/index.css, src/App.css y src/styles: tokens semánticos, composición editorial y responsive.
- tests: contratos, flujos, permisos, caché y entorno visual aislado.

No se instalaron dependencias nuevas: la red del entorno impidió añadir Router/Query/Radix. El enrutamiento usa History API, la caché React useSyncExternalStore y los diálogos HTMLDialogElement. Los menús implementan Escape, flechas, Home/End y devolución de foco. Los selects son nativos y estilizados, no sustitutos ARIA incompletos. La suite usa node:test y el TypeScript ya instalado; su loader solo se usa al ejecutar pruebas.

## Navegación

| Ruta | Acceso |
| --- | --- |
| /login | Público |
| /app | Dashboard contextual por rol |
| /app/courses | Catálogo publicado para estudiantes; todos los estados para gestión |
| /app/my-courses | Matrículas del estudiante o cursos del docente/autor |
| /app/courses/new | Docente / administrador |
| /app/courses/:courseId | Detalle y comprobación de matrícula |
| /app/courses/:courseId/edit | Propietario docente / administrador |
| /app/courses/:courseId/materials | Biblioteca; subida solo para responsable o administrador |
| /app/courses/:courseId/evaluations | Evaluaciones del curso |
| /app/courses/:courseId/evaluations/new | Responsable docente / administrador |
| /app/evaluations | Selector de curso, no listado global inventado |
| /app/evaluations/:evaluationId | Lectura/práctica local para estudiantes |
| /app/evaluations/:evaluationId/edit | Autor docente / administrador |
| /app/users y /app/users/:userId | Solo administrador |
| /app/enrollments | Administrador; docente puede consultar por enlace desde su curso |
| /app/profile | Usuario validado |

## Sesión y aislamiento

- Se valida siempre la cuenta con GET /v1/me antes de entrar al shell. El token es opaco: no se interpreta como JWT y no hay refresh.
- Se conserva la clave localStorage token del proyecto original y se encapsula en src/lib/session.ts. Solo se añade la caducidad devuelta por login; un token antiguo sin caducidad local se valida igualmente con /me.
- localStorage es accesible a JavaScript y, por tanto, vulnerable ante XSS. No equivale a una cookie HttpOnly. No se guardan contraseñas. Usar HTTPS, CSP en el hosting y evitar scripts de terceros. Una alternativa HttpOnly requiere soporte del backend, no se simula aquí.
- HTTP 401/403 limpia sesión, aborta trabajo privado y vacía la caché. FORBIDDEN dentro de HTTP 200 muestra el error de permisos sin desconectar una sesión válida.
- Logout intenta revocar en el backend y limpia localmente incluso si falla; se muestra un aviso si no pudo confirmarse la revocación remota.
- La caché está segmentada por tenantId y userId, no contiene el token en sus claves y se elimina al cambiar/cerrar/expirar sesión, incluso entre pestañas. Las respuestas tardías de otra sesión se descartan.
- El tenant solo se obtiene de /me. No hay selector de tenant ni header X-Tenant-Id. El backend sigue siendo la autoridad de permisos.

## Datos, paginación y diseño

La identidad Folio utiliza superficies cálidas, acentos vegetales, tipografía de sistema legible, iconografía vectorial consistente y tokens claros/oscuros. No depende de Google Fonts ni de imágenes remotas. Sidebar compacta persistente, drawer móvil, foco visible y reduced motion.

Las referencias reales encontradas fueron ideas/js-components/sidebars/sidebar-14, ideas/js-components/dropdowns y ideas/js-components/controls, además de sus equivalentes React. Se adaptaron sus patrones, sin copiar sus fondos, dependencias ni sus manipulaciones directas del DOM. Las rutas con errores ortográficos del encargo no existen literalmente; las carpetas de referencia no se alteraron.

Listados de cursos, usuarios y matrículas cargan páginas de 20 registros. Los filtros indican explícitamente que operan sobre lo cargado. nextToken se pasa intacto; páginas vacías no significan fin si hay cursor. Se detectan ciclos de cursores. Nunca se presenta el tamaño de una página como total del campus.

Mis cursos del estudiante resuelve matrículas activas por studentId y consulta cursos en grupos de cuatro, reutilizando la caché individual. Los cursos inexistentes se señalan sin romper el listado. El dashboard muestra una vista rápida, no estadísticas globales. Su actividad se limita explícitamente al curso seleccionado: materiales recientes y evaluaciones reales de ese curso.

## Materiales

Flujo exacto: registrar → pedir upload-url → PUT directo sin Bearer con el MIME registrado → confirmar → invalidar biblioteca. El progreso corresponde a bytes reportados por XMLHttpRequest, no a un temporizador.

El reintento durante la misma vista reutiliza contentId. Si el archivo ya subió, solo reintenta confirmación; si S3 rechaza la URL, pide otra. La confirmación es idempotente. Los pendientes no se buscan en el listado ni se inventa un endpoint de borrado. Cambiar de página o de archivo pierde el identificador de reintento de esa vista. Un timeout al registrar, sin respuesta con contentId, no permite saber si el backend creó un pendiente: esa ambigüedad requiere idempotencia/listado de pendientes del backend.

Las URLs de descarga se solicitan en cada acción y se abren inmediatamente en la pestaña actual para evitar bloqueo de popups. No se guardan en caché ni en localStorage.

## Evaluaciones y límites del backend

El constructor conserva IDs estables, permite preguntas/opciones dinámicas, corrige índices al quitar opciones y valida campos al publicar. Un nuevo recurso se guarda primero como borrador; desde su detalle se puede editar, publicar o cerrar. Las fechas se convierten de la zona local a UTC.

No se implementan entregas, intentos, notas, porcentajes de avance, eliminación de cursos, desmatriculación, edición/desactivación de usuarios ni cambios de contraseña: no hay contratos para esas operaciones. Para estudiantes, la práctica es solo local, sin persistencia, respuesta correcta ni calificación.

## Pruebas seguras

npm test no tiene acceso a AWS: los adaptadores aislados rechazan solicitudes no previstas. Cubre envelopes, HTTP 200 con error, 401/403, cancelación, logout fallido, permisos, guardas renderizados, cursores, matrícula, publicación y recuperación S3. Ver IMPLEMENTATION.md para inventario de archivos y verificación.

Para inspección visual con datos exclusivamente ficticios:

```sh
npm run test:ui
```

Abre http://127.0.0.1:4173. Cuentas de fixture: student@example.test, teacher@example.test o admin@example.test; contraseña exclusivamente local test-only. No son credenciales del backend real. Los cinco servicios se sustituyen solo en ese proceso por un servidor en 127.0.0.1:4174. No modifica .env, no se incluye en dist y todas las escrituras son en memoria. Detén el proceso antes de cambiar al entorno real. No publiques este servidor de pruebas.

## Publicación

npm run build genera dist. El hosting debe servir index.html como fallback para rutas /app/* y /login (SPA). No se creó otro proyecto, no se registró hosting nuevo ni se desplegaron cambios. La comprobación contra AWS requiere una sesión autorizada y conectividad; las pruebas aisladas no certifican el despliegue, CORS real ni permisos server-side.
