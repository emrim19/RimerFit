import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTemplates } from '../hooks/useTemplates'
import type { WorkoutTemplate } from '../hooks/useTemplates'
import { useExercises } from '../hooks/useExercises'
import type { Exercise } from '../hooks/useExercises'
import ExercisePicker from '../components/ExercisePicker'

// ── Colour swatch picker ───────────────────────────────────────

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb923c', '#fbbf24',
  '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#2563eb', '#64748b',
]

function ColorSwatch({ color, onChange }: { color: string | null; onChange: (c: string | null) => void }) {
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
        title="Pick a colour"
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 transition-colors hover:border-slate-500"
      >
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color ?? '#334155' }} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-10 z-20 w-52 rounded-2xl border border-slate-700 bg-slate-800/95 p-3 shadow-2xl backdrop-blur-sm"
          onClick={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
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
          {color && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-300"
            >
              Remove colour
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Edit state ────────────────────────────────────────────────

interface EditExercise {
  exercise_id: string
  name: string
  type: Exercise['type']
  default_sets: number
}

// ── Component ─────────────────────────────────────────────────

export default function Templates() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { templates, loading, refetch } = useTemplates()
  const { exercises, refetch: refetchExercises, editExercise, deleteExercise } = useExercises()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<string | null>(null)
  const [editExercises, setEditExercises] = useState<EditExercise[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function startEdit(t: WorkoutTemplate) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditColor(t.color)
    setEditExercises(t.exercises.map(e => ({
      exercise_id: e.exercise_id,
      name: e.name,
      type: e.type,
      default_sets: e.default_sets,
    })))
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setSaveError(null)
  }

  async function saveEdit() {
    if (!editName.trim()) { setSaveError('Name is required.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const { error: tmplErr } = await supabase
        .from('workout_templates')
        .update({ name: editName.trim(), color: editColor })
        .eq('id', editingId!)
      if (tmplErr) throw tmplErr

      // Replace all exercises for this template
      const { error: delErr } = await supabase
        .from('workout_template_exercises')
        .delete()
        .eq('template_id', editingId!)
      if (delErr) throw delErr

      if (editExercises.length > 0) {
        const rows = editExercises.map((e, i) => ({
          template_id: editingId!,
          exercise_id: e.exercise_id,
          order_index: i,
          default_sets: e.default_sets,
        }))
        const { error: insertErr } = await supabase
          .from('workout_template_exercises')
          .insert(rows)
        if (insertErr) throw insertErr
      }

      await refetch()
      cancelEdit()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await supabase.from('workout_templates').delete().eq('id', id)
    await refetch()
    setDeletingId(null)
    setConfirmDeleteId(null)
  }

  function addExercise(exercise: Exercise) {
    setEditExercises(prev => [
      ...prev,
      { exercise_id: exercise.id, name: exercise.name, type: exercise.type, default_sets: 3 },
    ])
  }

  async function createExercise(data: { name: string; type: Exercise['type']; muscle_group: string | null }): Promise<Exercise> {
    const { data: created, error } = await supabase
      .from('exercises')
      .insert({ ...data, user_id: user!.id })
      .select('id, name, muscle_group, type')
      .single()
    if (error || !created) throw new Error(error?.message ?? 'Failed to create exercise')
    await refetchExercises()
    return created as Exercise
  }

  function updateDefaultSets(index: number, delta: number) {
    setEditExercises(prev =>
      prev.map((e, i) => i !== index ? e : { ...e, default_sets: Math.max(1, e.default_sets + delta) })
    )
  }

  function removeExercise(index: number) {
    setEditExercises(prev => prev.filter((_, i) => i !== index))
  }

  const addedIds = new Set(editExercises.map(e => e.exercise_id))

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-slate-100">Templates</h1>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && templates.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 py-12 text-center text-sm text-slate-500">
          No templates yet — build a workout in <strong>Log workout</strong> and save it as a template.
        </p>
      )}

      <div className="space-y-3">
        {templates.map(t => {
          const isEditing = editingId === t.id
          const isConfirmingDelete = confirmDeleteId === t.id

          return (
            <div
              key={t.id}
              className="rounded-xl border border-slate-700 bg-slate-900"
            >
              {isEditing ? (
                // ── Edit mode ────────────────────────────────
                <div className="p-4">
                  {/* Name + colour */}
                  <div className="mb-4 flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Template name"
                      autoFocus
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <ColorSwatch color={editColor} onChange={setEditColor} />
                  </div>

                  {/* Exercise list */}
                  <div className="mb-3 space-y-2">
                    {editExercises.length === 0 && (
                      <p className="text-sm text-slate-600">No exercises — add some below.</p>
                    )}
                    {editExercises.map((ex, i) => (
                      <div key={ex.exercise_id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                        <span className="min-w-0 flex-1 text-sm text-slate-200">{ex.name}</span>
                        {/* Default sets stepper */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateDefaultSets(i, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm text-slate-300">
                            {ex.default_sets}×
                          </span>
                          <button
                            type="button"
                            onClick={() => updateDefaultSets(i, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExercise(i)}
                          className="text-xs text-slate-600 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setPickerOpen(true)}
                    className="mb-4 w-full rounded-lg border border-dashed border-slate-700 py-2 text-sm text-slate-400 hover:border-blue-500 hover:text-blue-500"
                  >
                    + Add exercise
                  </button>

                  {saveError && <p className="mb-3 text-xs text-red-400">{saveError}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-600 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : isConfirmingDelete ? (
                // ── Delete confirmation ───────────────────────
                <div className="p-4">
                  <p className="mb-3 text-sm font-medium text-red-400">
                    Delete <span className="text-slate-200">"{t.name}"</span>? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingId === t.id ? 'Deleting…' : 'Yes, delete'}
                    </button>
                  </div>
                </div>
              ) : (
                // ── View mode ────────────────────────────────
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color ?? '#334155' }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100">{t.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {t.exercises.length === 0
                          ? 'No exercises'
                          : t.exercises.map(e => `${e.name} (${e.default_sets}×)`).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      onClick={() => startEdit(t)}
                      className="text-sm text-slate-400 hover:text-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(t.id)}
                      className="text-sm text-slate-600 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          addedIds={addedIds}
          onSelect={ex => { addExercise(ex); setPickerOpen(false) }}
          onCreate={createExercise}
          onEdit={editExercise}
          onDelete={deleteExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
