import { useState } from 'react'
import { useQuery } from '../../hooks/useQuery'
import { useScope } from '../../hooks/useCourses'
import { materialList,materialDownload,materialDelete } from '../../services/MaterialService'
import { useUser } from '../../context/AuthContext'
import { canManage } from '../../lib/permissions'
import { clearDeletedMaterial } from '../../lib/deletions'
import { DeleteButton } from '../../components/shared/DeleteButton'
import { fileSize,date } from '../../lib/format'
import { queryCache } from '../../lib/queryCache'
import { session } from '../../lib/session'
import { useToast } from '../../context/ToastContext'
import { EmptyState,ErrorState,LoadingSkeleton } from '../../components/shared/States'
import { Button } from '../../components/ui/Controls'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { FileUploader } from './FileUploader'

function mimeIcon(type: string): IconName { return type.startsWith('video/')? 'video':type.startsWith('image/')? 'image':type==='application/zip'? 'archive':'file' }
export default function MaterialsPanel({ courseId,editable }: { courseId: string; editable: boolean }) {
  const scope=useScope()
  const user=useUser()
  const notify=useToast()
  const query=useQuery([...scope,'materials',courseId],signal => materialList(courseId,signal))
  const [upload,setUpload]=useState(false)
  const [downloading,setDownloading]=useState('')
  const [downloadError,setDownloadError]=useState<unknown>(null)
  async function download(id: string) {
    if(downloading) return
    const scopeSignal=session.signal()
    setDownloading(id)
    setDownloadError(null)
    try {
      const { downloadUrl }=await materialDownload(id,scopeSignal,courseId)
      if(!scopeSignal.aborted) window.location.assign(downloadUrl)
    } catch(error) { if(!scopeSignal.aborted) setDownloadError(error) }
    finally { setDownloading('') }
  }
  return <section className="stack">
    <div className="section-heading">
      <div>
        <h2>Biblioteca del curso</h2>
        <p className="muted">Ideas y recursos para volver cuando lo necesites.</p>
      </div>
      {editable&&<Button variant="secondary" onClick={() => setUpload(!upload)} aria-expanded={upload}>
        <Icon name={upload? 'close':'upload'} size={17} />
        {upload? 'Cerrar formulario':'Subir material'}
      </Button>}
    </div>
    {upload&&<FileUploader courseId={courseId} onSuccess={() => { queryCache.invalidate([...scope,'materials',courseId]); notify('Material subido y confirmado.') }} />}
    <ErrorState error={query.error} retry={() => void query.refetch()} />
    <ErrorState error={downloadError} compact />
    {query.isLoading? <LoadingSkeleton />:query.data?.items.length? <div className="material-list">
      {query.data.items.map(item => <article className="material-row" key={item.contentId}>
        <span className={'material-icon mime-'+item.mimeType.split('/')[0]}>
          <Icon name={mimeIcon(item.mimeType)} size={23} />
        </span>
        <div className="material-copy">
          <h3>{item.title}</h3>
          <p>
            {item.mimeType.split('/')[1].toUpperCase()}
            <span>·</span>
            {fileSize(item.sizeBytes)}
            <span>·</span>
            {date(item.confirmedAt??item.createdAt)}
          </p>
        </div>
        <div className="material-actions button-group"><Button variant="ghost" className="download-button" loading={downloading===item.contentId} disabled={Boolean(downloading)&&downloading!==item.contentId} onClick={() => void download(item.contentId)} aria-label={'Descargar '+item.title}>
          <Icon name="download" size={18} />
          <span>Descargar</span>
        </Button>
        {canManage(user,item.uploadedBy)&&<DeleteButton label="Eliminar material" description={'Se eliminará '+item.title+' ('+item.contentId+'). El sistema también intentará borrar el archivo almacenado. Esta acción no se puede deshacer.'} remove={() => materialDelete(item.contentId)} onDeleted={() => clearDeletedMaterial(scope,courseId)} />}
        </div>
      </article>)}
    </div>:!query.error&&<EmptyState icon="file" title="Un estante por llenar" description={editable? 'Comparte el primer material y dale forma al aprendizaje.':'Los materiales confirmados aparecerán aquí cuando el docente los comparta.'} action={editable&&!upload? <Button variant="secondary" onClick={() => setUpload(true)}>Subir el primer material</Button>:undefined} />}
  </section>
}
