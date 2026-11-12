import { API_CONTENT } from '../api/api'
import { ApiError } from '../api/errors'
import type { Material, MaterialMime } from '../types/lms'
export const materialList = (courseId: string, signal?: AbortSignal) => API_CONTENT.get<{ items: Material[] }>('/materials', { params: { courseId }, signal })
export const materialDownload = (id: string, signal?: AbortSignal) => API_CONTENT.get<{ downloadUrl: string; expiresIn: number }>('/materials/' + encodeURIComponent(id) + '/download-url', { signal })

export function putToS3(url: string, file: Blob, mimeType: MaterialMime, onProgress: (progress: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Subida cancelada', 'AbortError')); return }
    const xhr = new XMLHttpRequest()
    function abort() { xhr.abort() }
    function finish(error?: Error) {
      signal?.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    xhr.open('PUT', url)
    xhr.timeout = 600000
    xhr.setRequestHeader('Content-Type', mimeType)
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) finish()
      else finish(new ApiError(xhr.status === 403 ? 'UPLOAD_URL_EXPIRED' : 'UPLOAD_ERROR', xhr.status === 403 ? 'S3 rechazó la URL: puede haber expirado o no coincidir la firma. Reintenta para solicitar una URL nueva.' : 'S3 no pudo guardar el archivo. HTTP ' + xhr.status))
    }
    xhr.onerror = () => finish(new ApiError('NETWORK_ERROR', 'No se pudo conectar a S3.'))
    xhr.ontimeout = () => finish(new ApiError('TIMEOUT', 'S3 tardó demasiado.'))
    xhr.onabort = () => finish(new DOMException('Subida cancelada', 'AbortError'))
    signal?.addEventListener('abort', abort, { once: true })
    xhr.send(file)
  })
}

export interface UploadTask { contentId?: string; uploaded: boolean }
export type UploadPhase = 'registering' | 'signing' | 'uploading' | 'confirming' | 'complete'
export interface UploadInput { courseId: string; title: string; file: File; mimeType: MaterialMime }

export async function uploadMaterial(input: UploadInput, task: UploadTask, onPhase: (phase: UploadPhase) => void, onProgress: (progress: number) => void, signal?: AbortSignal) {
  if (!task.contentId) {
    onPhase('registering')
    const result = await API_CONTENT.post<{ contentId: string; uploadStatus: 'pending' }>('/materials', { courseId: input.courseId, title: input.title, fileName: input.file.name, mimeType: input.mimeType, sizeBytes: input.file.size }, { signal })
    task.contentId = result.contentId
  }
  const path = '/materials/' + encodeURIComponent(task.contentId)
  if (!task.uploaded) {
    onPhase('signing')
    try {
      const { uploadUrl } = await API_CONTENT.post<{ uploadUrl: string; expiresIn: number }>(path + '/upload-url', undefined, { signal })
      onPhase('uploading')
      await putToS3(uploadUrl, input.file, input.mimeType, onProgress, signal)
      task.uploaded = true
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'CONFLICT')) throw error
      task.uploaded = true
    }
  }
  onPhase('confirming')
  const result = await API_CONTENT.post<{ contentId: string; uploadStatus: 'confirmed' }>(path + '/confirm', undefined, { signal })
  onPhase('complete')
  return result
}
