# LMS Grupo 3 — Documentación Completa de la API (para Frontend)

> Referencia exhaustiva de **todos los endpoints HTTP** de los 5 microservicios del sistema LMS multi-tenant (serverless: API Gateway REST + Lambda + DynamoDB + S3 + SNS/SQS + Step Functions).
>
> Fuente de verdad: código fuente en `services/*/src/handlers.py` y `services/*/serverless.yml`. URLs desplegadas en stage `dev` (`endpoints-dev.md`).

---

## Índice

1. [Convenciones globales (LEER PRIMERO)](#1-convenciones-globales)
2. [Autenticación](#2-autenticación)
3. [API Usuarios](#3-api-usuarios) — 6 endpoints
4. [API Cursos](#4-api-cursos) — 4 endpoints
5. [API Matrículas](#5-api-matrículas) — 2 endpoints
6. [API Contenidos](#6-api-contenidos) — 5 endpoints
7. [API Evaluaciones](#7-api-evaluaciones) — 4 endpoints
8. [Catálogo de códigos de error](#8-catálogo-de-códigos-de-error)
9. [Tabla resumen de endpoints](#9-tabla-resumen-de-endpoints)
10. [Cliente base para el frontend](#10-cliente-base-para-el-frontend)
11. [Credenciales de prueba](#11-credenciales-de-prueba)

---

## Base URLs (stage dev, us-east-1)

| Servicio | Base URL |
|---|---|
| **Usuarios** | `https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev` |
| **Cursos** | `https://290ukd638e.execute-api.us-east-1.amazonaws.com/dev` |
| **Matrículas** | `https://hg230hgizk.execute-api.us-east-1.amazonaws.com/dev` |
| **Contenidos** | `https://ainxkn7mq0.execute-api.us-east-1.amazonaws.com/dev` |
| **Evaluaciones** | `https://c1b3902w19.execute-api.us-east-1.amazonaws.com/dev` |
| **S3 (materiales)** | Bucket `lms-materiales-198909467842-dev` (acceso solo vía presigned URLs) |

---

## 1. Convenciones globales

### 1.1 Formato de respuesta — "envelope"

** TODAS las APIs devuelven SIEMPRE HTTP `200` para éxito Y para errores de negocio.** El estado real está en el body:

**Éxito:**
```json
{
  "data": { ... },
  "requestId": "9c1d2f0a-1111-4bbb-8ccc-222233334444"
}
```

**Error de negocio:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Course not found"
  },
  "requestId": "9c1d2f0a-1111-4bbb-8ccc-222233334444"
}
```

- `requestId` es un UUID v4 aleatorio generado por cada Lambda (NO es el Request ID de API Gateway; no sirve para rastrear en CloudWatch).
- **El frontend DEBE inspeccionar el body (`data` vs `error`) y no confiarse del status HTTP 200.**

### 1.2 Códigos HTTP reales que puede recibir el frontend

| Status HTTP | Quién lo genera | Causa | Body |
|---|---|---|---|
| **200** | Lambda | Éxito **o cualquier error de negocio** | `{"data":...}` o `{"error":{...}}` |
| **401** | API Gateway | Falta el header `Authorization` en endpoint privado | `{"message":"Missing Authentication Token"}` |
| **403** | API Gateway (authorizer) | Token inválido, sesión expirada (8 h) o sesión revocada (logout) | `{"message":"User is not authorized to access this resource with an explicit deny"}` |
| **405** | API Gateway | Método no definido sobre un path existente (ej. `DELETE /v1/courses`) | `{"message":"Missing Authentication Token"}` |
| **502** | Lambda (excepción no manejada) | Body JSON malformado, `limit` no numérico, `nextToken` corrupto, fallo DynamoDB/S3 | `{"message":"Internal server error"}` |
| **504** | API Gateway | Lambda excede su timeout (30 s) | `{"message":"Endpoint request timed out"}` |

> ⚠️ **NO existen 201, 400, 404, 409 ni 500 emitidos por los handlers.** Crear, no encontrado y conflicto son todos `200` con `error.code` = `NOT_FOUND` / `CONFLICT` / etc.

### 1.3 Headers

| Header | Obligatorio | Valor |
|---|---|---|
| `Authorization` | En todos los endpoints excepto `POST /v1/auth/login` | `Bearer <accessToken>` |
| `Content-Type` | En requests con body | `application/json` |
| `X-Tenant-Id` | ❌ **NO EXISTE** | El tenant SIEMPRE se deriva del token (sesión en DynamoDB), nunca lo envía el cliente |

### 1.4 CORS

Todas las APIs y el bucket S3 tienen CORS habilitado (`Access-Control-Allow-Origin: *`). El preflight `OPTIONS` lo responde API Gateway automáticamente. Se puede consumir la API desde un navegador sin proxy.

### 1.5 Roles

| Rol | Descripción | Permisos clave |
|---|---|---|
| `tenant_admin` | Admin del tenant | Todo: crear usuarios/cursos/materiales/evaluaciones, matricular, actualizar cualquier recurso del tenant |
| `teacher` | Profesor | Crear cursos/materiales/evaluaciones (solo puede editar los suyos), ver todo |
| `student` | Estudiante | Auto-matricularse, ver cursos/materiales/evaluaciones publicadas de cursos donde está matriculado |

### 1.6 Paginación (solo `GET /v1/courses`, `GET /v1/users`, `GET /v1/enrollments`)

| Query param | Tipo | Default | Descripción |
|---|---|---|---|
| `limit` | int | `20` | Máx **100** (`min(limit, 100)`). Valor no numérico → HTTP 502 |
| `nextToken` | string (base64) | — | Cursor opaco devuelto en la respuesta anterior. Tal cual, sin decodificar |

Respuesta paginada:
```json
{ "data": { "items": [ ... ], "nextToken": "eyJwayI6..." } }
```
`nextToken` es `null` (JSON null) cuando no hay más páginas.

### 1.7 Formatos comunes

| Campo | Formato / Ejemplo |
|---|---|
| IDs usuario | `USR-A-00201` (letra del tenant + sufijo) |
| IDs curso | `CRS-A-00001` |
| IDs material | `CNT-3f2a9d8c-1b2c-4d5e-6f7a-8b9c0d1e2f3a` (UUID) |
| IDs evaluación | `EVL-3f2c8f1e-a1b2-4c3d-9e0f-112233445566` (UUID) |
| IDs matrícula | `ENR-7c9e6679-7425-40de-944b-e07fc7f5c1a1` (UUID) |
| Tenant | `TENANT_A` \| `TENANT_B` \| `TENANT_C` |
| Fechas | ISO-8601 UTC: `"2026-11-10T14:22:05Z"` |

---

## 2. Autenticación

### 2.1 Resumen del flujo

1. El usuario hace `POST /v1/auth/login` con `email` + `password`.
2. La API devuelve un **token opaco** (`accessToken`, ~43 caracteres `token_urlsafe`), tipo `Bearer`, válido **8 horas** (`expiresIn: 28800`).
3. El frontend guarda el token (ej. `localStorage`) y lo envía en `Authorization: Bearer <token>` en TODAS las demás llamadas.
4. Cada request valida la sesión contra DynamoDB (authorizer Lambda, sin caché: `resultTtlInSeconds: 0`).
5. `POST /v1/auth/logout` **revoca inmediatamente** el token (el siguiente request con ese token recibe `403`).

**No hay JWT ni refresh token.** El "payload" equivalente (inyectado por el authorizer a los handlers) es: `tenantId`, `userId`, `role`.

### 2.2 Comportamiento ante token inválido/expirado

- HTTP **401**: solo si falta el header `Authorization` por completo.
- HTTP **403** con `{"message":"User is not authorized to access this resource with an explicit deny"}`: token incorrecto, sesión expirada (TTL 8 h) o token revocado tras logout.
- **Recomendación frontend:** ante 401/403 real (HTTP status, no `error.code`), limpiar sesión y redirigir al login.

### 2.3 Bloqueo por intentos fallidos (login)

Tras **5 intentos** fallidos de contraseña, el login devuelve `TOO_MANY_ATTEMPTS` ("Account temporarily locked"). El contador **solo se resetea con un login exitoso** (no hay ventana temporal ni desbloqueo automático).

---

## 3. API Usuarios

Base: `https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev`

### 3.1 `POST /v1/auth/login` — Iniciar sesión

| | |
|---|---|
| **Auth** | Público (sin token) |
| **Roles** | Cualquiera con cuenta |

**Request** — headers: `Content-Type: application/json`. Body:

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `email` | string | ✅ | Se normaliza con `trim().lower()`. Sin regex de formato |
| `password` | string | ✅ | Sin política de complejidad |

```bash
curl -X POST "https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tenant-a.edu","password":"AdminA-Seguro-2026!"}'
```

**Response 200 — éxito:**
```json
{
  "data": {
    "accessToken": "q3fZ9x0m...43-caracteres",
    "tokenType": "Bearer",
    "expiresIn": 28800,
    "user": {
      "userId": "USR-A-00201",
      "email": "student00201@tenant-a.edu",
      "role": "student",
      "tenantId": "TENANT_A"
    }
  },
  "requestId": "..."
}
```

**Responses de error (todos HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `INVALID_BODY` | `email and password are required` | Falta email o password |
| `INVALID_CREDENTIALS` | `Invalid email or password` | Email no existe, usuario inactivo, o password incorrecto (mismo mensaje, anti-enumeración) |
| `TOO_MANY_ATTEMPTS` | `Account temporarily locked` | 5+ intentos fallidos acumulados |

> HTTP **502** si el body no es JSON válido.

---

### 3.2 `POST /v1/auth/logout` — Cerrar sesión

| | |
|---|---|
| **Auth** | `Authorization: Bearer <token>` |
| **Roles** | Cualquier rol autenticado |
| **Body** | Ninguno (se ignora) |

```bash
curl -X POST "https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev/v1/auth/logout" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200:**
```json
{ "data": {}, "requestId": "..." }
```

**Errores:** sin errores de negocio propios. HTTP **401** sin header; HTTP **403** con token inválido/expirado. Tras logout exitoso, cualquier uso posterior del token devuelve **403**.

---

### 3.3 `GET /v1/me` — Mi perfil

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | Cualquier rol autenticado |
| **Query/Body** | Ninguno |

```bash
curl "https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev/v1/me" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200:**
```json
{
  "data": {
    "pk": "TENANT#TENANT_A",
    "sk": "USER#USR-A-00201",
    "entityType": "USER",
    "userId": "USR-A-00201",
    "tenantId": "TENANT_A",
    "email": "student00201@tenant-a.edu",
    "role": "student",
    "status": "active",
    "createdAt": "2026-01-10T04:12:33Z"
  },
  "requestId": "..."
}
```
> Nota: incluye campos internos `pk`/`sk` de DynamoDB (ignorarlos en el frontend). Nunca expone el hash de password.

**Error (HTTP 200):** `NOT_FOUND` / `User not found` — solo si la sesión existe pero el usuario fue borrado.

---

### 3.4 `POST /v1/users` — Crear usuario

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | **Solo `tenant_admin`** |

**Request body:**

| Campo | Tipo | Requerido | Validación / Default |
|---|---|---|---|
| `email` | string | ✅ | `trim().lower()`. **Unicidad GLOBAL** (entre todos los tenants). Sin regex |
| `password` | string | ✅ | Sin política de complejidad |
| `role` | string | ❌ | Default `"student"`. Enum: `student` \| `teacher` \| `tenant_admin` |

> El usuario siempre se crea en el tenant del admin que llama (no hay campo para elegir tenant).

```bash
curl -X POST "https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev/v1/users" \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{"email":"nuevo@tenant-a.edu","password":"Clave-123!","role":"teacher"}'
```

**Response 200:**
```json
{
  "data": {
    "userId": "USR-A-9F3AB21C",
    "email": "nuevo@tenant-a.edu",
    "role": "teacher"
  },
  "requestId": "..."
}
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `FORBIDDEN` | `Only tenant admins can create users` | Rol ≠ `tenant_admin` |
| `INVALID_BODY` | `email and password are required` | Falta email o password |
| `INVALID_BODY` | `Invalid role` | `role` fuera del enum |
| `CONFLICT` | `Email already exists` | Email ya registrado (en cualquier tenant) |

---

### 3.5 `GET /v1/users` — Listar usuarios del tenant

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | **Solo `tenant_admin`** |
| **Query** | `limit` (default 20, máx 100), `nextToken` |

```bash
curl "https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev/v1/users?limit=50" \
  -H "Authorization: Bearer <adminToken>"
```

**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "pk": "TENANT#TENANT_A",
        "sk": "USER#USR-A-00001",
        "entityType": "USER",
        "userId": "USR-A-00001",
        "tenantId": "TENANT_A",
        "email": "teacher00001@tenant-a.edu",
        "role": "teacher",
        "status": "active",
        "createdAt": "2026-01-10T04:12:33Z"
      }
    ],
    "nextToken": null
  },
  "requestId": "..."
}
```

> No hay filtro por role/email/status — solo paginación. `nextToken` es base64 del cursor de DynamoDB: pasar tal cual.

**Responses de error:**

| HTTP | `error.code` | `error.message` |
|---|---|---|
| 200 | `FORBIDDEN` | `Only tenant admins can list users` |
| 502 | — | `limit` no numérico o `nextToken` corrupto (excepción no manejada) |

---

### 3.6 `GET /v1/users/{userId}` — Obtener usuario

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `tenant_admin` (cualquier usuario **de su tenant**); `teacher`/`student` solo **su propio** registro |
| **Path param** | `userId` (ej. `USR-A-00201`) |

```bash
curl "https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev/v1/users/USR-A-00201" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200:** mismo objeto usuario que `GET /v1/me`.

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `FORBIDDEN` | `Access denied` | No es admin y no es uno mismo |
| `NOT_FOUND` | `User not found` | No existe en el tenant del llamador (incluye IDs de otro tenant) |

---

## 4. API Cursos

Base: `https://290ukd638e.execute-api.us-east-1.amazonaws.com/dev`

Objeto curso público (sin `pk`/`sk`/`GSI1PK`/`GSI1SK`): `entityType`, `courseId`, `tenantId`, `teacherId`, `title`, `description`, `status`, `createdAt` [, `updatedAt`].

### 4.1 `POST /v1/courses` — Crear curso

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `tenant_admin`, `teacher` |

**Request body:**

| Campo | Tipo | Requerido | Validación / Default |
|---|---|---|---|
| `title` | string | ✅ | `trim()`. Sin regex ni longitudes |
| `description` | string | ❌ | `trim()`. Default `""` |

> El curso se crea con `status: "draft"` (no configurable al crear) y `teacherId` = userId del llamador (aunque sea admin).

```bash
curl -X POST "https://290ukd638e.execute-api.us-east-1.amazonaws.com/dev/v1/courses" \
  -H "Authorization: Bearer <teacherToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Curso de Python","description":"Intro a Python"}'
```

**Response 200:**
```json
{
  "data": {
    "entityType": "COURSE",
    "courseId": "CRS-A-9F8E7D6C",
    "tenantId": "TENANT_A",
    "teacherId": "USR-A-00001",
    "title": "Curso de Python",
    "description": "Intro a Python",
    "status": "draft",
    "createdAt": "2026-11-10T15:30:00Z"
  },
  "requestId": "..."
}
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `FORBIDDEN` | `Only admins and teachers can create courses` | Rol = `student` |
| `INVALID_BODY` | `title is required` | Falta title / vacío |

---

### 4.2 `GET /v1/courses` — Listar cursos

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | Cualquier rol autenticado (incluye `student`) |

**Query params:**

| Param | Tipo | Requerido | Default | Notas |
|---|---|---|---|---|
| `limit` | int | ❌ | 20 | Máx 100. No numérico → 502 |
| `nextToken` | base64 | ❌ | — | Cursor de página anterior |
| `teacherId` | string | ❌ | — | Filtra por profesor del tenant (GSI). Cualquier rol puede filtrar por cualquier teacher |

```bash
curl "https://290ukd638e.execute-api.us-east-1.amazonaws.com/dev/v1/courses?limit=20&teacherId=USR-A-00001" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "entityType": "COURSE",
        "courseId": "CRS-A-00001",
        "tenantId": "TENANT_A",
        "teacherId": "USR-A-00001",
        "title": "Curso 00001 — TENANT_A",
        "description": "Descripción del curso CRS-A-00001",
        "status": "published",
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ],
    "nextToken": null
  },
  "requestId": "..."
}
```

> Sin filtro por status: lista `draft`, `published` y `archived` para cualquier rol.

**Errores:** solo 401/403 (auth) o 502 (`limit`/`nextToken` inválidos).

---

### 4.3 `GET /v1/courses/{courseId}` — Obtener curso

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | Cualquier rol autenticado |
| **Path param** | `courseId` |

```bash
curl "https://290ukd638e.execute-api.us-east-1.amazonaws.com/dev/v1/courses/CRS-A-00001" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200:** objeto curso (igual que el POST).

**Response de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `NOT_FOUND` | `Course not found` | No existe en el tenant del token (incluye curso de otro tenant) |

---

### 4.4 `PATCH /v1/courses/{courseId}` — Actualizar curso

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `tenant_admin` (cualquier curso del tenant); `teacher` **solo si es dueño** (`teacherId == userId`) |

**Request body** (todos opcionales, **al menos uno requerido**):

| Campo | Tipo | Validación |
|---|---|---|
| `title` | string | `trim()` |
| `description` | string | `trim()` |
| `status` | string | **Enum:** `draft` \| `published` \| `archived` |

```bash
curl -X PATCH "https://290ukd638e.execute-api.us-east-1.amazonaws.com/dev/v1/courses/CRS-A-00001" \
  -H "Authorization: Bearer <teacherToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Curso de Python v2","status":"published"}'
```

**Response 200** (curso completo actualizado, agrega `updatedAt`):
```json
{
  "data": {
    "entityType": "COURSE",
    "courseId": "CRS-A-00001",
    "tenantId": "TENANT_A",
    "teacherId": "USR-A-00001",
    "title": "Curso de Python v2",
    "description": "Intro a Python",
    "status": "published",
    "createdAt": "2026-11-10T15:30:00Z",
    "updatedAt": "2026-11-10T16:00:00Z"
  },
  "requestId": "..."
}
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `NOT_FOUND` | `Course not found` | No existe en el tenant |
| `FORBIDDEN` | `Teachers can only update their own courses` | Teacher ≠ dueño |
| `INVALID_BODY` | `No valid fields to update` | Body vacío o sin campos reconocidos |
| `INVALID_BODY` | `status must be one of ('draft', 'published', 'archived')` | status fuera del enum (mensaje literal con paréntesis Python) |

---

## 5. API Matrículas

Base: `https://hg230hgizk.execute-api.us-east-1.amazonaws.com/dev`

Objeto matrícula público: `entityType`, `enrollmentId`, `tenantId`, `courseId`, `studentId`, `status`, `createdAt`.

### 5.1 `POST /v1/enrollments` — Matricular estudiante

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `student` (se auto-matricula); `tenant_admin` (matricula a otro, indicando `studentId`). `teacher` → rechazado |

**Request body:**

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `courseId` | string | ✅ | `trim()` |
| `studentId` | string | ✅ **solo si rol = `tenant_admin`** | Si rol = `student` se ignora y se usa el `userId` del token |

```bash
curl -X POST "https://hg230hgizk.execute-api.us-east-1.amazonaws.com/dev/v1/enrollments" \
  -H "Authorization: Bearer <studentToken>" \
  -H "Content-Type: application/json" \
  -d '{"courseId":"CRS-A-00001"}'
```

**La operación es SÍNCRONA** (Step Functions Express `start_sync_execution`): la respuesta HTTP llega cuando el flujo terminó. El POST valida internamente (orden): estudiante existe+activo+del tenant → curso existe+`published` → escribe matrícula (atómico, con detección de duplicado).

**Response 200:**
```json
{
  "data": {
    "enrollmentId": "ENR-7c9e6679-7425-40de-944b-e07fc7f5c1a1",
    "courseId": "CRS-A-00001",
    "studentId": "USR-A-00201",
    "status": "active",
    "createdAt": "2026-11-10T15:30:00Z"
  },
  "requestId": "..."
}
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `INVALID_BODY` | `courseId is required` | Falta courseId |
| `INVALID_BODY` | `studentId is required for admins` | Admin sin studentId |
| `FORBIDDEN` | `Only students and admins can create enrollments` | Rol = `teacher` |
| `NOT_FOUND` | `Student not found or inactive` | studentId inexistente/inactivo |
| `NOT_FOUND` | `Resource not found` | studentId de otro tenant (TenantMismatch) |
| `NOT_FOUND` | `Course not found or not published` | Curso inexistente o en `draft`/`archived` |
| `CONFLICT` | `Student is already enrolled in this course` | Matrícula duplicada |
| `INTERNAL_ERROR` | `<cause>` | Fallo inesperado del Step Function |

**Flujo asíncrono posterior (transparente para el frontend):** tras responder, la matrícula dispara Outbox → DynamoDB Stream → SNS (`lms-enrollment-created-dev`) → SQS → consumer (para notificaciones). No hay endpoint para consultar el estado de esa notificación; el resultado de la matrícula ya está en la respuesta del POST.

---

### 5.2 `GET /v1/enrollments` — Listar matrículas

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `student`: solo sus propias (si pasa `studentId` ajeno → error). `teacher`/`tenant_admin`: sin restricciones |

**Query params:**

| Param | Tipo | Requerido | Notas |
|---|---|---|---|
| `courseId` | string | ⚠️ **Al menos uno de `courseId`/`studentId`** | Lista matriculados de un curso |
| `studentId` | string | ⚠️ ídem | Lista cursos de un estudiante |
| `limit` | int | ❌ | Default 20, máx 100 |
| `nextToken` | base64 | ❌ | Cursor |

```bash
curl "https://hg230hgizk.execute-api.us-east-1.amazonaws.com/dev/v1/enrollments?studentId=USR-A-00201" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "entityType": "ENROLLMENT",
        "enrollmentId": "ENR-7c9e6679-7425-40de-944b-e07fc7f5c1a1",
        "tenantId": "TENANT_A",
        "courseId": "CRS-A-00001",
        "studentId": "USR-A-00201",
        "status": "active",
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ],
    "nextToken": null
  },
  "requestId": "..."
}
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `INVALID_BODY` | `courseId or studentId query param is required` | Faltan ambos filtros |
| `FORBIDDEN` | `Students can only list their own enrollments` | Student pidiendo `studentId` ajeno |

> Nota: un `student` que filtra solo por `courseId` (sin `studentId`) sí puede listar los matriculados de ese curso.

---

## 6. API Contenidos

Base: `https://ainxkn7mq0.execute-api.us-east-1.amazonaws.com/dev`

Ciclo de vida del material (`uploadStatus`): **`pending`** (registrado, sin archivo) → **`confirmed`** (archivo subido y verificado en S3).

MIME types permitidos (`mimeType`):

```
application/pdf | video/mp4 | image/jpeg | image/png | application/zip | text/plain
```

Objeto material público (listado): `entityType`, `contentId`, `tenantId`, `courseId`, `uploadedBy`, `title`, `s3Key`, `mimeType`, `sizeBytes`, `uploadStatus`, `createdAt` [, `confirmedAt`].

### 6.1 `POST /v1/materials` — Registrar material

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `tenant_admin`, `teacher` |

**Request body:**

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `courseId` | string | ✅ | `trim()`. No se valida existencia del curso |
| `title` | string | ✅ | `trim()` |
| `fileName` | string | ✅ | `trim()`. Se usa tal cual en la clave S3 |
| `mimeType` | string | ✅ | **Enum de 6 MIME types** (arriba) |
| `sizeBytes` | number | ❌ | Default `0`. Solo informativo, no se valida contra el archivo real |

```bash
curl -X POST "https://ainxkn7mq0.execute-api.us-east-1.amazonaws.com/dev/v1/materials" \
  -H "Authorization: Bearer <teacherToken>" \
  -H "Content-Type: application/json" \
  -d '{"courseId":"CRS-A-00001","title":"Material Semana 1","fileName":"apunte.pdf","mimeType":"application/pdf","sizeBytes":204800}'
```

**Response 200** (solo estos 2 campos):
```json
{ "data": { "contentId": "CNT-3f2a9d8c-1b2c-4d5e-6f7a-8b9c0d1e2f3a", "uploadStatus": "pending" }, "requestId": "..." }
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `FORBIDDEN` | `Only admins and teachers can upload materials` | Rol = `student` |
| `INVALID_BODY` | `courseId, title, fileName and mimeType are required` | Falta alguno de los 4 |
| `INVALID_BODY` | `mimeType not allowed` | MIME fuera del enum |

---

### 6.2 `POST /v1/materials/{contentId}/upload-url` — URL firmada de subida

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `tenant_admin`, `teacher` |
| **Path param** | `contentId` |
| **Body** | Ninguno |

```bash
curl -X POST "https://ainxkn7mq0.execute-api.us-east-1.amazonaws.com/dev/v1/materials/CNT-3f2a.../upload-url" \
  -H "Authorization: Bearer <teacherToken>"
```

**Response 200:**
```json
{
  "data": {
    "uploadUrl": "https://lms-materiales-198909467842-dev.s3.amazonaws.com/TENANT_A/CRS-A-00001/CNT-.../apunte.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&...&X-Amz-Expires=300",
    "expiresIn": 300
  },
  "requestId": "..."
}
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `FORBIDDEN` | `Only admins and teachers can get upload URLs` | Rol = `student` |
| `NOT_FOUND` | `Content not found` | contentId no existe en el tenant |
| `CONFLICT` | `Content already uploaded` | El material ya está `confirmed` |

> Si el material está `pending` se pueden pedir URLs repetidas (cada una vale 5 min).

**Uso de la URL (paso siguiente, directo a S3 sin token LMS):**
```js
await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': mimeType },  // ⚠️ EXACTAMENTE el mimeType registrado (va firmado en la URL)
  body: file,                              // Blob/File del navegador
});
```
- S3 responde `200`/`204` al éxito; **`403 SignatureDoesNotMatch`** si el `Content-Type` difiere del registrado.
- El bucket tiene CORS para `PUT` desde cualquier origen (subida directa desde navegador OK).
- No hay límite de tamaño verificado server-side.

---

### 6.3 `POST /v1/materials/{contentId}/confirm` — Confirmar subida

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | ⚠️ **Cualquier rol autenticado** (no hay check de rol; aislamiento solo por tenant) |
| **Path param** | `contentId` |
| **Body** | Ninguno |

Verifica con `head_object` que el archivo realmente existe en S3. Si sí, marca `uploadStatus: confirmed` + `confirmedAt`. Es idempotente (re-confirmar no da error).

```bash
curl -X POST "https://ainxkn7mq0.execute-api.us-east-1.amazonaws.com/dev/v1/materials/CNT-3f2a.../confirm" \
  -H "Authorization: Bearer <teacherToken>"
```

**Response 200:**
```json
{ "data": { "contentId": "CNT-3f2a...", "uploadStatus": "confirmed" }, "requestId": "..." }
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `NOT_FOUND` | `Content not found` | contentId no existe en el tenant |
| `BAD_REQUEST` | `File not found in S3, complete the upload first` | El PUT a S3 no se hizo (o falló) |

---

### 6.4 `GET /v1/materials?courseId=...` — Listar materiales

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | Cualquier rol autenticado |
| **Query** | `courseId` **requerido**. ⚠️ **Sin paginación** (no acepta limit/nextToken) |

> **Solo devuelve materiales `confirmed`** (los `pending` son invisibles en el listado).

```bash
curl "https://ainxkn7mq0.execute-api.us-east-1.amazonaws.com/dev/v1/materials?courseId=CRS-A-00001" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "entityType": "CONTENT",
        "contentId": "CNT-3f2a9d8c-1b2c-4d5e-6f7a-8b9c0d1e2f3a",
        "tenantId": "TENANT_A",
        "courseId": "CRS-A-00001",
        "uploadedBy": "USR-A-00001",
        "title": "Material Semana 1",
        "s3Key": "TENANT_A/CRS-A-00001/CNT-.../apunte.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 204800,
        "uploadStatus": "confirmed",
        "createdAt": "2026-01-15T10:00:00Z",
        "confirmedAt": "2026-01-15T10:05:00Z"
      }
    ]
  },
  "requestId": "..."
}
```

**Response de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `INVALID_BODY` | `courseId query param is required` | Falta courseId |

---

### 6.5 `GET /v1/materials/{contentId}/download-url` — URL firmada de descarga

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `student`: **requiere matrícula activa** en el curso del material. `teacher`/`tenant_admin`: sin restricción |
| **Path param** | `contentId` |

```bash
curl "https://ainxkn7mq0.execute-api.us-east-1.amazonaws.com/dev/v1/materials/CNT-3f2a.../download-url" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200** (URL vale **60 segundos**):
```json
{
  "data": {
    "downloadUrl": "https://lms-materiales-198909467842-dev.s3.amazonaws.com/TENANT_A/.../apunte.pdf?X-Amz-...&X-Amz-Expires=60",
    "expiresIn": 60
  },
  "requestId": "..."
}
```
El navegador puede abrir la URL directamente (`window.open(downloadUrl)` o `<a href>`). No requiere headers.

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `NOT_FOUND` | `Content not found` | No existe, **o** existe pero está `pending` (mismo mensaje a propósito) |
| `FORBIDDEN` | `You are not enrolled in this course` | Student sin matrícula activa en el curso |

### 6.6 Diagrama del flujo de subida completo

```
Admin/Teacher:
  1. POST /v1/materials                       → 200 {contentId, uploadStatus:"pending"}
  2. POST /v1/materials/{id}/upload-url       → 200 {uploadUrl, expiresIn:300}   (CONFLICT si ya confirmed)
  3. PUT <uploadUrl> + Content-Type=mimeType  → 200/204 (S3 directo)              (403 si Content-Type difiere)
  4. POST /v1/materials/{id}/confirm          → 200 {contentId, uploadStatus:"confirmed"}
                                                     (BAD_REQUEST si no subieron el archivo)

Student (matriculado):
  5. GET /v1/materials?courseId=X             → lista solo confirmed
  6. GET /v1/materials/{id}/download-url      → 200 {downloadUrl, expiresIn:60} → abrir URL
```

---

## 7. API Evaluaciones

Base: `https://c1b3902w19.execute-api.us-east-1.amazonaws.com/dev`

Objeto evaluación público: `entityType`, `evaluationId`, `tenantId`, `courseId`, `teacherId`, `title`, `status`, `questions` [, `fechaLimite`], `createdAt` [, `updatedAt`].

- `status`: `draft` | `published` | `closed`
- Estructura de cada `question`:
  - **teacher/admin**: `{ "questionId": "Q1", "text": "...", "options": ["...","..."], "correctIndex": 0 }`
  - **student**: igual **pero SIN `correctIndex`** (el backend lo elimina para students)

### 7.1 `POST /v1/evaluations` — Crear evaluación

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `tenant_admin`, `teacher` |

**Request body:**

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `courseId` | string | ✅ | `trim()`. No se valida existencia del curso |
| `title` | string | ✅ | `trim()` |
| `questions` | array | ❌ | Default `[]`. **No se valida al crear** (solo al publicar) |
| `fechaLimite` | string | ❌ | Passthrough sin validación (ej. `"2026-12-31T23:59:00Z"`) |

> Se crea con `status: "draft"` fijo y `teacherId` = userId del llamador.

```bash
curl -X POST "https://c1b3902w19.execute-api.us-east-1.amazonaws.com/dev/v1/evaluations" \
  -H "Authorization: Bearer <teacherToken>" \
  -H "Content-Type: application/json" \
  -d '{"courseId":"CRS-A-00001","title":"Quiz 1","questions":[{"questionId":"Q1","text":"¿Qué significa SaaS?","options":["Software as a Service","Storage as a System"],"correctIndex":0}],"fechaLimite":"2026-12-31T23:59:00Z"}'
```

**Response 200:**
```json
{
  "data": {
    "entityType": "EVALUATION",
    "evaluationId": "EVL-3f2c8f1e-a1b2-4c3d-9e0f-112233445566",
    "tenantId": "TENANT_A",
    "courseId": "CRS-A-00001",
    "teacherId": "USR-A-00001",
    "title": "Quiz 1",
    "status": "draft",
    "questions": [
      { "questionId": "Q1", "text": "¿Qué significa SaaS?", "options": ["Software as a Service", "Storage as a System"], "correctIndex": 0 }
    ],
    "fechaLimite": "2026-12-31T23:59:00Z",
    "createdAt": "2026-11-10T14:22:05Z"
  },
  "requestId": "..."
}
```

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `FORBIDDEN` | `Only admins and teachers can create evaluations` | Rol = `student` |
| `INVALID_BODY` | `courseId and title are required` | Falta courseId o title |

---

### 7.2 `GET /v1/evaluations?courseId=...` — Listar evaluaciones de un curso

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | Cualquier rol. **`student` solo ve `published`** (teachers/admins ven también `draft`/`closed`) |
| **Query** | `courseId` **requerido**. ⚠️ **Sin paginación** (devuelve todas) |

```bash
curl "https://c1b3902w19.execute-api.us-east-1.amazonaws.com/dev/v1/evaluations?courseId=CRS-A-00001" \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200 (vista student — sin `correctIndex`):**
```json
{
  "data": {
    "items": [
      {
        "entityType": "EVALUATION",
        "evaluationId": "EVL-1a2b3c4d-...",
        "tenantId": "TENANT_A",
        "courseId": "CRS-A-00001",
        "teacherId": "USR-A-00001",
        "title": "Quiz 1 — Curso 00001",
        "status": "published",
        "fechaLimite": "2026-12-31T23:59:00Z",
        "questions": [
          { "questionId": "Q1", "text": "¿Qué significa SaaS?", "options": ["Software as a Service", "Storage as a System", "Server as a Service"] },
          { "questionId": "Q2", "text": "¿Cuál es la ventaja principal de serverless?", "options": ["Pago por uso", "Mayor control del servidor", "Menor latencia siempre"] }
        ],
        "createdAt": "2026-01-10T04:12:33Z"
      }
    ]
  },
  "requestId": "..."
}
```
> Para `teacher`/`tenant_admin`, cada question incluye además `"correctIndex"`.

**Response de error (HTTP 200):**

| `error.code` | `error.message` |
|---|---|
| `INVALID_BODY` | `courseId query param is required` |

---

### 7.3 `GET /v1/evaluations/{evaluationId}` — Obtener evaluación

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | Cualquier rol, con reglas para `student` |
| **Path param** | `evaluationId` |

**Reglas para `student`:**
1. Si la evaluación no es `published` → `NOT_FOUND` (draft/closed invisibles).
2. Debe estar **matriculado activamente** en el curso de la evaluación → si no, `FORBIDDEN`.

```bash
curl "https://c1b3902w19.execute-api.us-east-1.amazonaws.com/dev/v1/evaluations/EVL-1a2b3c4d-..." \
  -H "Authorization: Bearer <accessToken>"
```

**Response 200:** objeto evaluación individual (misma estructura que los items del listado, con/sin `correctIndex` según rol).

**Responses de error (HTTP 200):**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `NOT_FOUND` | `Evaluation not found` | No existe en el tenant, o student pidiendo draft/closed |
| `FORBIDDEN` | `You are not enrolled in this course` | Student sin matrícula activa |

---

### 7.4 `PATCH /v1/evaluations/{evaluationId}` — Actualizar evaluación

| | |
|---|---|
| **Auth** | Bearer |
| **Roles** | `tenant_admin`: cualquier evaluación del tenant. `teacher`: **solo las suyas** (`teacherId == userId`). ⚠️ El código no bloquea explícitamente a `student` |

**Request body** (todos opcionales, **al menos uno requerido**):

| Campo | Tipo | Validación |
|---|---|---|
| `title` | string | `trim()` |
| `questions` | array | Reemplazo completo. Validado solo si se publica |
| `fechaLimite` | string | Passthrough |
| `status` | string | **Enum:** `draft` \| `published` \| `closed` |

**Validaciones al publicar** (`status = "published"`), aplican a las `questions` del body (o las existentes si no vienen):

| Regla | `error.message` |
|---|---|
| Mínimo 3 preguntas | `At least 3 questions are required to publish` |
| Cada pregunta con texto | `Each question must have text` |
| Mínimo 2 opciones | `Each question must have at least 2 options` |
| `correctIndex` int válido (< len(options)) | `Each question must have a valid correctIndex` |

```bash
curl -X PATCH "https://c1b3902w19.execute-api.us-east-1.amazonaws.com/dev/v1/evaluations/EVL-1a2b3c4d-..." \
  -H "Authorization: Bearer <teacherToken>" \
  -H "Content-Type: application/json" \
  -d '{"status":"published","questions":[{"questionId":"Q1","text":"¿Qué significa SaaS?","options":["Software as a Service","Storage as a System"],"correctIndex":0},{"questionId":"Q2","text":"¿Cola de mensajes en AWS?","options":["S3","SQS","SNS"],"correctIndex":1},{"questionId":"Q3","text":"¿Compute serverless?","options":["EC2","Lambda","RDS"],"correctIndex":1}]}'
```

**Response 200** (evaluación actualizada, agrega `updatedAt`; incluye `correctIndex` para teacher/admin):
```json
{
  "data": {
    "entityType": "EVALUATION",
    "evaluationId": "EVL-1a2b3c4d-...",
    "tenantId": "TENANT_A",
    "courseId": "CRS-A-00001",
    "teacherId": "USR-A-00001",
    "title": "Quiz 1 — Curso 00001",
    "status": "published",
    "questions": [ ... ],
    "createdAt": "2026-01-10T04:12:33Z",
    "updatedAt": "2026-11-10T16:00:00Z"
  },
  "requestId": "..."
}
```

**Responses de error (HTTP 200) — mensajes literales:**

| `error.code` | `error.message` | Causa |
|---|---|---|
| `NOT_FOUND` | `Evaluation not found` | No existe en el tenant |
| `FORBIDDEN` | `Teachers can only update their own evaluations` | Teacher ≠ dueño |
| `INVALID_BODY` | `No valid fields to update` | Body vacío / sin campos reconocidos |
| `INVALID_BODY` | `status must be one of ('draft', 'published', 'closed')` | status fuera del enum |
| `INVALID_BODY` | `At least 3 questions are required to publish` | Publicar con < 3 questions |
| `INVALID_BODY` | `Each question must have text` | Pregunta sin `text` |
| `INVALID_BODY` | `Each question must have at least 2 options` | < 2 opciones |
| `INVALID_BODY` | `Each question must have a valid correctIndex` | correctIndex inválido |

---

## 8. Catálogo de códigos de error

Todos llegan como **HTTP 200** con `{"error":{"code","message"},"requestId":...}`:

| `code` | Significado | Dónde aparece |
|---|---|---|
| `INVALID_BODY` | Body/query inválido o incompleto | Todas las APIs |
| `INVALID_CREDENTIALS` | Email o password incorrecto en login | usuarios |
| `TOO_MANY_ATTEMPTS` | Cuenta bloqueada por 5 intentos fallidos | usuarios |
| `FORBIDDEN` | Rol insuficiente / no dueño / no matriculado | Todas |
| `NOT_FOUND` | Recurso no existe (o existe en otro tenant) | Todas |
| `CONFLICT` | Email duplicado / material ya subido / matrícula duplicada | usuarios, contenidos, matrículas |
| `BAD_REQUEST` | Archivo no encontrado en S3 al confirmar | contenidos |
| `INTERNAL_ERROR` | Fallo del Step Function de matrículas | matrículas |

---

## 9. Tabla resumen de endpoints

| # | Método | Path | API | Roles | Paginación |
|---|---|---|---|---|---|
| 1 | POST | `/v1/auth/login` | usuarios | público | — |
| 2 | POST | `/v1/auth/logout` | usuarios | cualquier rol | — |
| 3 | GET | `/v1/me` | usuarios | cualquier rol | — |
| 4 | POST | `/v1/users` | usuarios | tenant_admin | — |
| 5 | GET | `/v1/users` | usuarios | tenant_admin | ✅ |
| 6 | GET | `/v1/users/{userId}` | usuarios | admin o uno mismo | — |
| 7 | POST | `/v1/courses` | cursos | admin, teacher | — |
| 8 | GET | `/v1/courses` | cursos | cualquier rol | ✅ (+`teacherId`) |
| 9 | GET | `/v1/courses/{courseId}` | cursos | cualquier rol | — |
| 10 | PATCH | `/v1/courses/{courseId}` | cursos | admin, teacher dueño | — |
| 11 | POST | `/v1/enrollments` | matrículas | student, admin | — |
| 12 | GET | `/v1/enrollments` | matrículas | student (propias), teacher, admin | ✅ (curso o student) |
| 13 | POST | `/v1/materials` | contenidos | admin, teacher | — |
| 14 | GET | `/v1/materials?courseId=` | contenidos | cualquier rol | ❌ |
| 15 | POST | `/v1/materials/{contentId}/upload-url` | contenidos | admin, teacher | — |
| 16 | POST | `/v1/materials/{contentId}/confirm` | contenidos | ⚠️ cualquier rol | — |
| 17 | GET | `/v1/materials/{contentId}/download-url` | contenidos | student matriculado, teacher, admin | — |
| 18 | POST | `/v1/evaluations` | evaluaciones | admin, teacher | — |
| 19 | GET | `/v1/evaluations?courseId=` | evaluaciones | cualquier rol (student: solo published) | ❌ |
| 20 | GET | `/v1/evaluations/{evaluationId}` | evaluaciones | student matriculado, teacher, admin | — |
| 21 | PATCH | `/v1/evaluations/{evaluationId}` | evaluaciones | admin, teacher dueño | — |

---

## 10. Cliente base para el frontend

Wrapper que maneja el envelope (`data`/`error`), el Bearer token y la expiración de sesión:

```js
const BASE = {
  usuarios:     'https://bqr9yndpkh.execute-api.us-east-1.amazonaws.com/dev',
  cursos:       'https://290ukd638e.execute-api.us-east-1.amazonaws.com/dev',
  matriculas:   'https://hg230hgizk.execute-api.us-east-1.amazonaws.com/dev',
  contenidos:   'https://ainxkn7mq0.execute-api.us-east-1.amazonaws.com/dev',
  evaluaciones: 'https://c1b3902w19.execute-api.us-east-1.amazonaws.com/dev',
};

class ApiError extends Error {
  constructor(code, message, requestId) {
    super(message);
    this.code = code;          // ej. 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT'
    this.requestId = requestId;
  }
}

async function api(service, method, path, { body, query, token = localStorage.getItem('accessToken') } = {}) {
  const url = new URL(BASE[service] + path);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

  const res = await fetch(url, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // 401/403/502/504 reales de API Gateway: body {"message": "..."} sin envelope
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('accessToken');
    throw new ApiError('SESSION_INVALID', 'Sesión expirada o inválida');
  }

  const json = await res.json();
  if (json.error) throw new ApiError(json.error.code, json.error.message, json.requestId);
  if (!res.ok)    throw new ApiError('HTTP_' + res.status, json.message || 'Error del gateway');
  return json.data;
}

// --- Ejemplos de uso ---
// Login:
//   const { accessToken, user } = await api('usuarios', 'POST', '/v1/auth/login',
//     { body: { email, password }, token: null });
//   localStorage.setItem('accessToken', accessToken);
// Mis cursos:      await api('cursos', 'GET', '/v1/courses', { query: { limit: 20 } })
// Matricularme:    await api('matriculas', 'POST', '/v1/enrollments', { body: { courseId } })
// Subir material:  const m = await api('contenidos', 'POST', '/v1/materials', { body: {...} });
//                  const { uploadUrl } = await api('contenidos', 'POST', `/v1/materials/${m.contentId}/upload-url`);
//                  await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: file });
//                  await api('contenidos', 'POST', `/v1/materials/${m.contentId}/confirm`);
// Descargar:       const { downloadUrl } = await api('contenidos', 'GET', `/v1/materials/${id}/download-url`);
//                  window.open(downloadUrl); // la URL expira en 60 s
```

---

## 11. Credenciales de prueba

| Tenant | Email | Password | Rol |
|---|---|---|---|
| TENANT_A | `admin@tenant-a.edu` | `AdminA-Seguro-2026!` | tenant_admin |
| TENANT_B | `admin@tenant-b.edu` | `AdminB-Seguro-2026!` | tenant_admin |
| TENANT_C | `admin@tenant-c.edu` | `AdminC-Seguro-2026!` | tenant_admin |
| TENANT_A | `teacher00001@tenant-a.edu` | `Seed2026!` | teacher |
| TENANT_A | `student00201@tenant-a.edu` | `Seed2026!` | student |

---

## Notas de comportamiento conocidas (a tener en cuenta en el frontend)

1. **Errores de negocio = HTTP 200**: siempre validar presencia de `error` en el body antes de usar `data`.
2. **Tenant aislado por sesión**: un ID de otro tenant devuelve `NOT_FOUND` (no `FORBIDDEN`) — tratarlo como "no existe".
3. `POST /v1/materials/{id}/confirm` **no valida rol** (cualquier autenticado del tenant puede confirmar).
4. `GET /v1/materials` y `GET /v1/evaluations` **no tienen paginación** (devuelven todo lo confirmado/publicado del curso).
5. Un `student` filtrando `GET /v1/enrollments` solo por `courseId` ve la lista de matriculados de ese curso.
6. Los listados de usuarios devuelven campos internos `pk`/`sk` — ignorarlos.
7. `limit <= 0` o `nextToken` corrupto producen **HTTP 502** (`{"message":"Internal server error"}`), sin envelope.
8. Login bloqueado tras 5 intentos fallidos; solo se desbloquea con un login exitoso (contraseña correcta).
9. Presigned URLs: subida 300 s (con `Content-Type` firmado), descarga 60 s. Redirigir al usuario inmediatamente tras obtener la de descarga.
