import { useEffect, useRef, useState } from 'react'
import type { WorkoutTemplate } from '../hooks/useTemplates'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#3b82f6', '#0ea5e9',
  '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
]

function TemplateColorDot({
  color,
  onChange,
}: {
  color: string | null
  onChange: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        title="Set template colour"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="h-4 w-4 rounded-full ring-2 ring-white/10 transition-all hover:scale-110 hover:ring-white/30"
        style={{ backgroundColor: color ?? '#64748b' }}
      />
      {open && (
        <div
          className="absolute left-0 top-6 z-20 w-44 rounded-2xl border border-slate-700 bg-slate-800/95 p-3 shadow-2xl backdrop-blur-sm"
          onClick={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => { onChange(c); setOpen(false) }}
                className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : undefined,
                  outlineOffset: color === c ? '2px' : undefined,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  templates: WorkoutTemplate[]
  onSelect: (template: WorkoutTemplate) => void
  onDelete: (id: string) => Promise<void>
  onColorChange: (id: string, color: string) => Promise<void>
  onClose: () => void
}

export default function TemplatePicker({ templates, onSelect, onDelete, onColorChange, onClose }: Props) {
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
        className="flex h-[80vh] w-full flex-col rounded-t-2xl bg-slate-900 sm:h-[70vh] sm:max-w-md sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="font-semibold text-slate-100">Templates</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {templates.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No templates yet — build a workout and save it as a template to reuse it later.
            </p>
          ) : (
            <ul className="space-y-2">
              {templates.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => { onSelect(t); onClose() }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-left transition-colors hover:border-blue-600 hover:bg-blue-950"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <TemplateColorDot
                          color={t.color}
                          onChange={color => onColorChange(t.id, color)}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-100">{t.name}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {t.exercises.length === 0
                              ? 'No exercises'
                              : t.exercises.map(e => e.name).join(' · ')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={e => handleDelete(e, t.id)}
                        disabled={deleting === t.id}
                        className="shrink-0 text-xs text-slate-600 hover:text-red-400 disabled:opacity-50"
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
