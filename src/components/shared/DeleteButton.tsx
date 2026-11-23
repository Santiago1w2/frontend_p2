import { useState } from 'react'
import { confirmDeleted } from '../../lib/deletions'
import { useAction } from '../../hooks/useAction'
import { useToast } from '../../context/ToastContext'
import type { DeletionResult } from '../../types/lms'
import { Button, ConfirmDialog } from '../ui/Controls'
import { Icon } from '../ui/Icon'
import { ErrorState } from './States'

export function DeleteButton({ label, description, remove, onDeleted }: { label: string; description: string; remove: () => Promise<DeletionResult>; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const notify = useToast()
  const action = useAction(async () => {
    const result = await remove()
    confirmDeleted(result)
    return result
  }, () => {
    setOpen(false)
    notify('Eliminación confirmada.')
    onDeleted()
  })
  return <>
    <Button variant="danger" onClick={() => { action.reset(); setOpen(true) }} disabled={action.pending}>
      <Icon name="trash" size={16} />{label}
    </Button>
    {open && <ConfirmDialog open onClose={() => setOpen(false)} title={label + ' · Confirmación'} description={description} confirmLabel="Eliminar definitivamente" danger pending={action.pending} error={<ErrorState error={action.error} compact />} onConfirm={() => void action.run(undefined)} />}
  </>
}
