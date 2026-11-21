export class ApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly status?: number
  constructor(code: string, message: string, requestId?: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.requestId = requestId
    this.status = status
  }
}
export function parseEnvelope<T>(body: unknown): T {
  if (!body || typeof body !== 'object') throw new ApiError('INVALID_RESPONSE', 'El servidor devolvió una respuesta no válida.')
  const envelope = body as Record<string, unknown>
  const requestId = typeof envelope.requestId === 'string' ? envelope.requestId : undefined
  if ('error' in envelope) {
    const error = envelope.error
    if (error && typeof error === 'object' && 'code' in error && 'message' in error && typeof error.code === 'string' && typeof error.message === 'string') throw new ApiError(error.code, error.message, requestId)
    throw new ApiError('INVALID_RESPONSE', 'El servidor devolvió un error no válido.', requestId)
  }
  if (!Object.hasOwn(envelope, 'data')) throw new ApiError('INVALID_RESPONSE', 'Falta el contenido de la respuesta.', requestId)
  return envelope.data as T
}
const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'El correo o la contraseña no son correctos.',
  TOO_MANY_ATTEMPTS: 'Cuenta bloqueada por intentos fallidos. Contacta al administrador; no hay desbloqueo automático documentado.',
  FORBIDDEN: 'No tienes permisos para esta acción o no cuentas con una matrícula activa.',
  NOT_FOUND: 'El recurso no existe o ya no está disponible en tu campus.',
  CONFLICT: 'El registro ya existe. Actualiza la lista antes de volver a intentarlo.',
  INTERNAL_ERROR: 'El servicio no pudo completar la operación. Comprueba el resultado antes de reintentar.',
  SESSION_EXPIRED: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  NETWORK_ERROR: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  TIMEOUT: 'El servicio tardó demasiado. Comprueba el resultado antes de repetir una operación.',
  SUBMISSION_UNCERTAIN: 'No pudimos confirmar la entrega. Consulta tu resultado antes de volver a enviar; no se ha repetido el envío automáticamente.',
  SUBMISSION_INCOMPLETE: 'Selecciona una respuesta válida en cada pregunta antes de enviar.',
  EVALUATION_CLOSED: 'La evaluación no admite entregas o su fecha límite ya pasó.',
  S3_ACCESS_DENIED: 'No se pudo acceder al archivo en S3. Solicita al responsable que revise su disponibilidad.',
  S3_ERROR: 'No se pudo verificar el archivo en S3. Vuelve a intentarlo.',
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return messages[error.code] ?? error.message
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}
