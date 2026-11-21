# Aurion · Frontend LMS

Frontend React, TypeScript y Vite conectado a los cinco microservicios del proyecto. Consume los **23 endpoints HTTP** declarados en el backend local, incluidos envío de quizzes y consulta de calificaciones. La integración no modifica el backend ni sus contratos.

## Ejecutar

Se requiere Node.js 24.15 o superior para las pruebas.

```sh
npm ci
npm run dev
```

`npm run dev` usa las URLs de tu `.env`. Introduce solo el correo al iniciar sesión; `EMAIL#`, `USER#` y `COURSE#` son prefijos internos de DynamoDB y no forman parte de los datos que se introducen en los formularios.

## Configuración de APIs

La configuración de URLs queda a cargo del responsable del despliegue. No se reemplazaron los valores existentes.

| Variable | Servicio |
| --- | --- |
| `VITE_API_V1_USER` | Usuarios y autenticación |
| `VITE_API_V1_COURSE` | Cursos |
| `VITE_API_V1_MATRICULAS` | Matrículas |
| `VITE_API_V1_CONTENIDOS` | Materiales y URLs firmadas |
| `VITE_API_V1_EVALUACIONES` | Evaluaciones, entregas y resultados |

Para otra instalación, copia `.env.example` y configura esas cinco variables. Las bases pueden terminar en `/dev` o `/dev/v1`, con o sin barra final: `versionedBase` agrega `/v1` una sola vez. Una variable ausente produce un error de configuración visible.

Las variables `VITE_*` se incorporan al JavaScript público. No pongas contraseñas ni claves privadas en ellas. Tras cambiar las URLs, reinicia Vite; en producción reconstruye y publica el frontend. Las cinco APIs deben pertenecer al entorno que comparta las sesiones, el tenant y las tablas esperadas.

## Contrato y cobertura de endpoints

Las rutas siguientes son relativas a la base versionada de cada servicio. Todas salvo login envían `Authorization: Bearer <token>`.

| Servicio | Método y ruta | Uso en frontend |
| --- | --- | --- |
| Usuarios | `POST /auth/login` | Inicio de sesión |
| Usuarios | `POST /auth/logout` | Revocación y cierre local |
| Usuarios | `GET /me` | Validación de sesión y perfil |
| Usuarios | `POST /users` | Creación de usuario por administrador |
| Usuarios | `GET /users` | Listado paginado y filtros locales |
| Usuarios | `GET /users/{userId}` | Detalle del usuario |
| Cursos | `POST /courses` | Creación en borrador |
| Cursos | `GET /courses` | Catálogo y cursos del docente mediante `teacherId` |
| Cursos | `GET /courses/{courseId}` | Detalle y resolución de Mis cursos |
| Cursos | `PATCH /courses/{courseId}` | Edición, publicación y archivado |
| Matrículas | `POST /enrollments` | Autoinscripción o matrícula administrativa |
| Matrículas | `GET /enrollments` | Consulta por curso/estudiante y comprobación de acceso |
| Contenidos | `POST /materials` | Registro previo de un archivo |
| Contenidos | `GET /materials?courseId=…` | Biblioteca del curso |
| Contenidos | `POST /materials/{contentId}/upload-url?courseId=…` | Solicitud de subida firmada |
| Contenidos | `POST /materials/{contentId}/confirm?courseId=…` | Confirmación de archivo subido |
| Contenidos | `GET /materials/{contentId}/download-url?courseId=…` | Descarga mediante URL nueva |
| Evaluaciones | `POST /evaluations` | Creación de borrador |
| Evaluaciones | `GET /evaluations?courseId=…` | Evaluaciones de un curso |
| Evaluaciones | `GET /evaluations/{evaluationId}` | Detalle y editor |
| Evaluaciones | `PATCH /evaluations/{evaluationId}` | Edición, publicación y cierre |
| Evaluaciones | `POST /evaluations/{evaluationId}/submit` | Entrega del estudiante |
| Evaluaciones | `GET /evaluations/{evaluationId}/result` | Resultado propio o consulta por `studentId` |

`ApiClient` desenvuelve `{data, requestId}` y rechaza `{error:{code,message}, requestId}`, aunque llegue con HTTP 200. Los errores conservan su referencia; un resultado ausente nunca se presenta como calificación cero. Los HTTP 401/403 del gateway limpian la sesión; un `FORBIDDEN` de negocio muestra el error sin cerrar una sesión válida.

## Navegación y permisos

| Ruta de la aplicación | Acceso y función |
| --- | --- |
| `/login` | Público |
| `/app` | Inicio contextual |
| `/app/courses` | Catálogo; solo publicados para estudiantes |
| `/app/my-courses` | Matrículas activas del estudiante o cursos del docente |
| `/app/courses/new` | Docente y administrador |
| `/app/courses/:courseId` | Detalle y autoinscripción del estudiante |
| `/app/courses/:courseId/edit` | Docente propietario o administrador |
| `/app/courses/:courseId/materials` | Materiales; subida por responsable/administrador |
| `/app/courses/:courseId/evaluations` | Evaluaciones del curso |
| `/app/courses/:courseId/evaluations/new` | Responsable del curso o administrador |
| `/app/evaluations` | Selector de curso y listado de evaluaciones |
| `/app/evaluations/:evaluationId` | Resolución del quiz o lectura y consulta de estudiantes |
| `/app/evaluations/:evaluationId/edit` | Autor docente o administrador |
| `/app/evaluations/:evaluationId/result` | Resultado propio, incluso tras cerrar la evaluación |
| `/app/evaluations/:evaluationId/result?studentId=USR-…` | Consulta docente/administrativa |
| `/app/results` | Consulta de calificaciones por ID de evaluación |
| `/app/users` y `/app/users/:userId` | Administrador |
| `/app/enrollments` | Administrador y docente; solo administrador crea matrículas |
| `/app/profile` | Perfil de consulta |

El docente consulta resultados de sus propias evaluaciones; el administrador puede consultar las del tenant. Al estudiante no se le solicita `studentId`: el servidor usa su sesión. Las guardas de React y la comprobación de propietario controlan la interfaz; la seguridad de las llamadas directas corresponde al backend.

## Evaluaciones y calificaciones

### Crear y publicar

Desde el curso, crea un borrador. El editor permite preguntas y opciones dinámicas con IDs estables, ajusta el índice correcto al quitar opciones y valida al publicar: título, al menos tres preguntas, texto, dos opciones como mínimo y un índice correcto entero dentro de rango. Las fechas se convierten de la hora local a UTC.

Un recurso nuevo se guarda primero como `draft`. Desde Editar evaluación se publica con `status: published` o se cierra con `status: closed`. Los registros antiguos que llegan sin `questionId`, o con IDs repetidos, reciben identidades locales estables y distintas, respetando el orden de sus preguntas. Si se editan, esas identidades se envían al guardar.

### Entregar como estudiante

1. Abre una evaluación publicada de un curso en el que tengas matrícula activa.
2. El frontend consulta `/result` antes de habilitar una entrega. Si la consulta falla, muestra el error y mantiene el envío bloqueado.
3. Selecciona una opción en cada pregunta. No se muestran las respuestas correctas.
4. Pulsa **Enviar evaluación** y confirma. Se envía únicamente `{"answers":[0,1,1]}`, con índices desde cero y en el orden recibido de `questions`.
5. Se muestra `score`, `correctAnswers`, `totalQuestions` y `submittedAt` devueltos por el servidor. `score` es porcentaje de 0 a 100; no se calcula ni se convierte a otra escala en el navegador.
6. Tras entregar, las opciones quedan bloqueadas. Al recargar se recuperan las respuestas y la nota mediante `/result`.

Antes de hacer POST se vuelve a consultar si hay resultado. Si ya existe, se muestra sin repetir el envío. Los errores de conflicto, timeout, red o respuesta incierta provocan una consulta de recuperación; nunca un reintento automático del POST. Si sigue sin poder confirmarse, usa **Consultar mi resultado** antes de decidir un nuevo intento. Dos clics simultáneos en la misma vista no crean dos acciones.

El frontend bloquea envíos al pasar `fechaLimite` y vuelve a comprobarla al confirmar. Esto depende del reloj del dispositivo y no reemplaza una validación del servidor. La API actual tampoco garantiza de forma atómica una sola entrega desde varias pestañas; esa limitación se conserva porque no se modifica el backend.

### Consultar después del cierre

Guarda el **Enlace de mi calificación** o el ID `EVL-…` de la evaluación. La página de resultado consulta `/result` independientemente del detalle: funciona aunque el backend oculte al estudiante una evaluación `closed`. Si se abre el enlace antiguo del detalle y recibe `NOT_FOUND`, también ofrece consultar la nota existente.

El menú **Calificaciones** permite ingresar ese ID. No se ofrece un historial global de notas porque el backend no tiene un endpoint que lo enumere; las evaluaciones cerradas tampoco aparecen en el listado del estudiante. Los resultados no se guardan en localStorage ni se comparten entre usuarios.

### Consultar como docente o administrador

Abre el detalle de una evaluación y ve a **Calificaciones de estudiantes**. El selector usa las matrículas paginadas del curso; también puedes introducir un ID `USR-…`. La consulta envía `?studentId=…`. Un alumno sin entrega muestra un estado explícito de ausencia, no una nota cero.

También puedes usar **Calificaciones** para consultar por evaluación y estudiante. Los enlaces con `studentId` conservan la consulta al recargar. El docente debe ser autor de la evaluación en la interfaz; el administrador puede consultar cualquier evaluación del tenant. No se inventan promedios, aprobaciones, intentos múltiples ni un listado global de calificaciones.

## Cursos, usuarios y matrículas

Los cursos se crean en borrador y se asignan a la cuenta que los crea. Para publicarlos: **Editar curso → Estado: Publicado → Guardar cambios**. El archivado usa el mismo PATCH con `status: archived`; no elimina el curso.

Los listados de cursos, usuarios y matrículas cargan páginas de 20 y conservan `nextToken` sin modificarlo. Una página vacía con cursor no significa fin. Se detectan cursores repetidos. El tamaño de una página no se presenta como total global.

Las búsquedas esperan 300 ms e ignoran espacios exteriores y diferencias de mayúsculas. Un **ID completo** usa directamente `GET /courses/{courseId}` o `GET /users/{userId}`, sin recorrer páginas ni volver al listado si devuelve `NOT_FOUND`. Se reconocen los IDs del seed (`CRS-A-00001`, `USR-A-00201`), los generados por el backend (`CRS-A-BCB2FDD0`, `USR-A-ABCDEF12`) y los administradores del bootstrap (`USR-ADMIN-TENANT_A`). Los IDs se normalizan a mayúsculas, como los genera el servidor.

Los filtros de estado y rol se aplican también al resultado directo. En Mis cursos se comprueba que el docente sea responsable o que el estudiante tenga matrícula activa; buscar por ID no amplía el acceso. Durante una consulta exacta se pausa la paginación y se cancelan recorridos anteriores. Al borrar el ID, se restaura el listado con sus filtros y registros cargados. Un fallo de red se muestra como error, no como un resultado inexistente.

Las búsquedas por nombre, correo o ID parcial conservan el recorrido paginado porque el backend no tiene endpoints equivalentes de búsqueda por texto. Con muchos registros pueden requerir numerosas solicitudes. El filtro de rol de usuarios también recorre páginas sin coincidencias. El catálogo del estudiante busca únicamente cursos publicados. Mis cursos resuelve matrículas activas y carga los detalles de cursos en grupos de cuatro, reutilizando caché y señalando recursos ausentes.

Para matrícula, el estudiante envía solo `courseId`; el administrador añade `studentId`. Se validan IDs `CRS-…` y `USR-…`, rechazando correos y prefijos internos de DynamoDB. La consulta ya usa los filtros `courseId` o `studentId` del endpoint de matrículas. Pulsar **Consultar** nuevamente con el mismo filtro fuerza una nueva lectura, sin conservar una respuesta vacía anterior. El backend da prioridad a `courseId` cuando se envían ambos filtros; el cliente filtra además los elementos recibidos por `studentId` y conserva el cursor hasta terminar. Esta defensa local no cambia qué datos autoriza el servidor.

## Materiales y descarga

Flujo de subida: registro → URL firmada → PUT directo a S3, sin Bearer y con el MIME registrado → confirmación → actualización de biblioteca. Se admite PDF, MP4, JPEG, PNG, ZIP y TXT, incluyendo aliases MIME habituales de Windows. El progreso usa bytes reales reportados por XMLHttpRequest.

`courseId` se envía al solicitar subida, confirmar y descargar, conforme al backend actual. La subida firmada dura 300 segundos y la descarga 60. El reintento en la misma vista conserva `contentId`; si ya subió, solo vuelve a confirmar. Cambiar archivo/página o recargar pierde el registro temporal. No hay endpoint para recuperar todos los pendientes ni para eliminarlos.

Para descargar, el frontend solicita una URL nueva cada vez y navega inmediatamente a `downloadUrl`. El backend usa metadatos de DynamoDB para ubicar el objeto y firma la descarga; el navegador obtiene el archivo de S3. No se guarda una URL permanente ni se reutiliza una firma en caché. Se presentan mensajes diferenciados para errores de acceso y verificación de S3.

## Sesión y caché

La cuenta se valida con `/me`. El token es opaco, no JWT, y no hay refresh. Se conserva la clave `token` de localStorage y la caducidad de login; las contraseñas no se guardan.

La caché está segmentada por tenant y usuario. Cerrar, reemplazar o expirar sesión aborta solicitudes privadas y limpia datos, también entre pestañas. Las respuestas tardías de una sesión anterior se descartan. El logout intenta revocar en backend y limpia localmente incluso si falla.

No hay selector de tenant ni header `X-Tenant-Id`; la sesión decide el tenant. localStorage no ofrece protección HttpOnly: la protección contra XSS y el transporte HTTPS corresponden también al entorno de publicación.

## Pruebas

```sh
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run build
```

`npm test` verifica contratos, envelope, errores de gateway y negocio, sesiones, permisos de interfaz, cursores, matrícula, publicación, subida S3, validación del quiz, recuperación de entregas y resultados. La prueba de CloudFormation usa la plantilla real de la raíz, `amplify-frontend.yaml`.

`npm run test:browser` ejecuta tres suites con Chrome/Edge sin interfaz y perfiles/puertos temporales: búsquedas, filtros y matrículas existentes; consultas directas por ID con comprobación de que no recorren listados, filtros y actualización de matrículas; y evaluación, entrega, recarga, consulta docente/admin, cierre, aislamiento entre usuarios y recuperación de una respuesta perdida después de guardar. `LMS_TEST_BROWSER` permite indicar el ejecutable Chromium. El navegador y Axios reales se conectan solo a fixtures HTTP locales; no se certifican AWS, IAM ni CORS real.

Para inspección interactiva aislada:

```sh
npm run test:ui
```

Abre `http://127.0.0.1:4173`. Usa `student@example.test`, `teacher@example.test` o `admin@example.test`, con contraseña local `test-only`. También hay `student2@example.test` y `student3@example.test`. No son cuentas de AWS. El aviso del login identifica este modo. Los servicios se sustituyen solo en ese proceso por `127.0.0.1:4174`, con escrituras en memoria y sin alterar `.env`. Detén ese proceso para volver al modo real y no publiques el servidor de pruebas.

## Publicación

`npm run build` genera `dist`. El hosting debe servir `index.html` como fallback para las rutas `/app/*` y `/login`.

La plantilla de frontend está en [`amplify-frontend.yaml`](amplify-frontend.yaml), en la raíz de este repositorio. Puedes cargarla en CloudFormation; solicita repositorio, rama, token de GitHub y las cinco URLs. Configura la compilación de Vite, publicación de `dist` y reglas SPA. La salida `StartBuildCommand` inicia la primera compilación y `FrontendUrl` indica la dirección publicada. Esta adaptación no crea stacks ni publica cambios.

La plantilla compila con `npm run build`; ejecuta también la suite y lint antes de publicar. Para confirmar el entorno real, comprueba con tus URLs y cuentas autorizadas: login, `/me`, cursos, matrícula, subida/descarga, publicación de evaluación, entrega de estudiante y consulta de notas por los tres roles.

## Límites del contrato conservado

El frontend cubre los 23 endpoints existentes. No hay rutas para borrar cursos/materiales, desmatricular, editar/desactivar usuarios, cambiar/restablecer contraseña, desbloquear cuentas ni gestionar varios intentos. No se crean llamadas a endpoints inexistentes.

Materiales y evaluaciones devuelven `items` sin cursor; el frontend muestra lo recibido y no puede recuperar páginas que el backend no expone. El bloqueo de login tras cinco fallos no tiene recuperación desde la API. La interfaz no corrige permisos del backend ni la configuración de cuentas AWS: esos elementos permanecen tal como están.

## Organización

- `src/api`: transporte Axios y traducción de errores.
- `src/services`: clientes de los cinco microservicios y recuperación de entregas.
- `src/features/evaluations`: editor, resolución, resultados y consulta de matrículas.
- `src/lib`: sesión, permisos, caché, rutas y validación de respuestas.
- `src/hooks`: consultas, acciones, paginación y búsquedas.
- `src/components` y `src/styles`: interfaz adaptable, navegación, temas y estados.
- `tests`: pruebas automáticas y simulación HTTP local de los servicios.
