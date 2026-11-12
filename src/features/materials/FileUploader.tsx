import { useEffect,useRef,useState } from 'react'
import type { FormEvent } from 'react'
import { uploadMaterial } from '../../services/MaterialService'
import type { UploadPhase,UploadTask } from '../../services/MaterialService'
import { allowedMimeTypes } from '../../types/lms'
import type { MaterialMime } from '../../types/lms'
import { session } from '../../lib/session'
import { fileSize } from '../../lib/format'
import { Button,FormField } from '../../components/ui/Controls'
import { ErrorState } from '../../components/shared/States'
import { Icon } from '../../components/ui/Icon'

const phaseLabels: Record<UploadPhase,string>={ registering: 'Registrando material',signing: 'Solicitando acceso seguro a S3',uploading: 'Subiendo el archivo',confirming: 'Verificando el archivo en S3',complete: 'Material confirmado' }
export function FileUploader({ courseId,onSuccess }: { courseId: string; onSuccess: () => void }) {
  const [file,setFile]=useState<File|null>(null)
  const [title,setTitle]=useState('')
  const [error,setError]=useState<unknown>(null)
  const [pending,setPending]=useState(false)
  const [phase,setPhase]=useState<UploadPhase|null>(null)
  const [progress,setProgress]=useState(0)
  const task=useRef<UploadTask>({ uploaded: false })
  const [taskState,setTaskState]=useState<UploadTask>({ uploaded: false })
  const controller=useRef<AbortController|null>(null)
  const input=useRef<HTMLInputElement>(null)
  useEffect(() => () => controller.current?.abort(),[])
  function select(selected?: File) {
    setError(null)
    setPhase(null)
    task.current={ uploaded: false }
    setTaskState({ uploaded: false })
    if(!selected) { setFile(null); return }
    if(!(allowedMimeTypes as readonly string[]).includes(selected.type)) { setFile(null); setError(new Error('Tipo no permitido. Selecciona PDF, MP4, JPEG, PNG, ZIP o texto plano con un MIME reconocido.')); return }
    setFile(selected)
    setTitle(selected.name.replace(/\.[^.]+$/,''))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if(!file||!title.trim()||pending) return
    const current=new AbortController()
    controller.current=current
    const signal=AbortSignal.any([current.signal,session.signal()])
    setPending(true)
    setError(null)
    setProgress(0)
    try {
      await uploadMaterial({ courseId,title: title.trim(),file,mimeType: file.type as MaterialMime },task.current,nextPhase => { setPhase(nextPhase); setTaskState({ ...task.current }) },setProgress,signal)
      if(!signal.aborted) { onSuccess(); setFile(null); setTitle(''); task.current={ uploaded: false }; if(input.current) input.current.value='' }
    } catch(error) { if(!signal.aborted) setError(error) }
    finally { setPending(false); setTaskState({ ...task.current }) }
  }
  return <form className="upload-panel stack" onSubmit={submit}>
    <div className="section-heading">
      <div>
        <p className="eyebrow">COMPARTE CON TU CURSO</p>
        <h2>Un recurso, muchas posibilidades.</h2>
      </div>
      <Icon name="upload" size={25} />
    </div>
    <label className={'file-drop '+(pending? 'disabled':'')} htmlFor="material-file">
      <span className="empty-icon">
        <Icon name="upload" size={23} />
      </span>
      <strong>{file? file.name:'Elige un archivo para compartir'}</strong>
      <span>{file? fileSize(file.size):'PDF, MP4, JPEG, PNG, ZIP o TXT'}</span>
      <input ref={input} id="material-file" type="file" accept={allowedMimeTypes.join(',')} onChange={event => select(event.target.files?.[0])} disabled={pending||Boolean(taskState.contentId)} />
    </label>
    {file&&<FormField id="material-title" label="Nombre del material">
      <input id="material-title" value={title} onChange={event => setTitle(event.target.value)} required disabled={pending||Boolean(taskState.contentId)} />
    </FormField>}
    <ErrorState error={error} compact />
    {taskState.contentId&&Boolean(error)&&<p className="field-hint">Registro pendiente: {taskState.contentId}. El reintento reutiliza este registro y {taskState.uploaded? 'solo vuelve a confirmar el archivo':'solicita una URL nueva'}. No recargues esta página para conservar el reintento.</p>}
    {pending&&<div className="upload-progress" role="status">
      <p>{phase? phaseLabels[phase]:'Preparando'}{phase==='uploading'? ' · '+progress+'%':'…'}</p>
      {phase==='uploading'&&<progress value={progress} max={100} aria-label="Progreso real de transferencia" />}
    </div>}
    {phase==='complete'&&!error&&<p className="success-text" role="status"><Icon name="check" size={17} />Material confirmado y disponible.</p>}
    <div className="form-actions">
      {pending? <Button variant="secondary" onClick={() => { controller.current?.abort(); setError(new Error('Subida cancelada. Puedes reintentar sin crear otro registro.')) }}>Cancelar transferencia</Button>:file&&<Button variant="secondary" onClick={() => { setFile(null); setTitle(''); task.current={ uploaded: false }; setTaskState({ uploaded: false }); setError(null); setPhase(null); if(input.current) input.current.value='' }}>Elegir otro archivo</Button>}
      <Button type="submit" disabled={!file||!title.trim()} loading={pending}>
        {error&&taskState.contentId? taskState.uploaded? 'Reintentar confirmación':'Reintentar subida':'Subir material'}
        <Icon name="upload" size={17} />
      </Button>
    </div>
    <p className="field-hint">El material aparece en la biblioteca únicamente después de confirmarse. No hay eliminación de registros pendientes en la API.</p>
  </form>
}
