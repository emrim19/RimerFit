import { useState } from 'react'
import type { WorkoutTemplate } from '../hooks/useTemplates'

interface Props {
  templates: WorkoutTemplate[]
  onSelect: (template: WorkoutTemplate) => void
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export default function TemplatePicker({ templates, onSelect, onDelete, onClose }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setDeleting(id)
    await onDelete(id)
    setDeleting(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full flex-col rounded-t-2xl bg-stone-900 sm:h-[70vh] sm:max-w-md sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
          <h2 className="font-semibold text-stone-100">Templates</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {templates.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">
              No templates yet — build a workout and save it as a template to reuse it later.
            </p>
          ) : (
            <ul className="space-y-2">
              {templates.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => { onSelect(t); onClose() }}
                    className="w-full rounded-xl border border-stone-700 bg-stone-800 px-4 py-3 text-left transition-colors hover:border-amber-600 hover:bg-amber-950"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-100">{t.name}</p>
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          {t.exercises.length === 0
                            ? 'No exercises'
                            : t.exercises.map(e => e.name).join(' · ')}
                        </p>
                      </div>
                      <button
                        onClick={e => handleDelete(e, t.id)}
                        disabled={deleting === t.id}
                        className="shrink-0 text-xs text-stone-600 hover:text-red-400 disabled:opacity-50"
                      >
                        {deleting === t.id ? '…' : '✕'}
                      </button>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
