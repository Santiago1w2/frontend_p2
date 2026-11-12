export function date(value?: string, options?: Intl.DateTimeFormatOptions) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PE', options ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
export function fileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
export function courseTone(id: string) {
  return Math.abs(Array.from(id).reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) | 0, 0)) % 4
}
