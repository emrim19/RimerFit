import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SetInputs, emptySet, setTypeLabel, inputCls } from '../components/SetInputs'
import type { SetRow, ExerciseType } from '../components/SetInputs'
import ExercisePicker from '../components/ExercisePicker'
import { useExercises } from '../hooks/useExercises'
import type { Exercise } from '../hooks/useExercises'
import { useMuscleGroupColors } from '../hooks/useMuscleGroupColors'

// ── Template colour swatch picker ─────────────────────────────

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#3b82f6', '#0ea5e9',
  '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
]

function ColorSwatch({
  color,
  onChange,
}: {
  color: string | null
  onChange: (c: string) => void
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
        title="Pick a colour"
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 transition-colors hover:border-slate-500"
      >
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color ?? '#334155' }} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-10 z-20 w-44 rounded-2xl border border-slate-700 bg-slate-800/95 p-3 shadow-2xl backdrop-blur-sm"
          onClick={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-2">
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
        </div>
      )}
    </div>
  )
}

// ── Data types ────────────────────────────────────────────────

interface WorkoutMeta {
  id: string
  title: string | null
  date: string
  duration_minutes: number | null
  is_rest_day: boolean
  color: string | null
}

interface SetDetail {
  id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  duration_seconds: number | null
  distance_meters: number | null
  rpe: number | null
}

interface ExerciseGroup {
  exercise_id: string
  name: string
  type: ExerciseType
  muscle_group: string | null
  sets: SetDetail[]
}

// ── Edit types ────────────────────────────────────────────────

interface EditSet extends SetRow {
  id: string // '' for new sets
}

interface EditGroup {
  exercise_id: string
  name: string
  type: ExerciseType
  muscle_group: string | null
  sets: EditSet[]
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatSet(set: SetDetail, type: ExerciseType): string {
  if (type === 'strength') {
    const parts: string[] = []
    if (set.reps) parts.push(`${set.reps} reps`)
    if (set.weight_kg) parts.push(`${set.weight_kg} kg`)
    return parts.join(' × ') || '—'
  }
  if (type === 'cardio') {
    const parts: string[] = []
    if (set.duration_seconds) parts.push(`${Math.round(set.duration_seconds / 60)} min`)
    if (set.distance_meters) parts.push(`${(set.distance_meters / 1000).toFixed(1)} km`)
    return parts.join(' · ') || '—'
  }
  const parts: string[] = []
  if (set.reps) parts.push(`${set.reps} reps`)
  if (set.rpe) parts.push(`RPE ${set.rpe}`)
  return parts.join(' · ') || '—'
}

function toEditSet(s: SetDetail): EditSet {
  return {
    id: s.id,
    reps: s.reps?.toString() ?? '',
    weight_kg: s.weight_kg?.toString() ?? '',
    duration_minutes: s.duration_seconds ? String(Math.round(s.duration_seconds / 60)) : '',
    distance_km: s.distance_meters ? String((s.distance_meters / 1000).toFixed(1)) : '',
    rpe: s.rpe?.toString() ?? '',
  }
}

// ── Component ─────────────────────────────────────────────────

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [workout, setWorkout] = useState<WorkoutMeta | null>(null)
  const [groups, setGroups] = useState<ExerciseGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editColor, setEditColor] = useState<string | null>(null)
  const [editGroups, setEditGroups] = useState<EditGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const { exercises, refetch: refetchExercises } = useExercises()
  const { getColor } = useMuscleGroupColors()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateColor, setTemplateColor] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [templateSaved, setTemplateSaved] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: w, error: wErr }, { data: setsData, error: sErr }] = await Promise.all([
      supabase.from('workouts').select('id, title, date, duration_minutes, is_rest_day, color').eq('id', id!).single(),
      supabase
        .from('workout_sets')
        .select('id, set_number, reps, weight_kg, duration_seconds, distance_meters, rpe, exercises(id, name, type, muscle_group)')
        .eq('workout_id', id!)
        .order('set_number'),
    ])

    if (wErr || !w) { setNotFound(true); setLoading(false); return }
    if (sErr) { setError(sErr.message); setLoading(false); return }

    const map = new Map<string, ExerciseGroup>()
    for (const row of setsData ?? []) {
      const ex = (Array.isArray(row.exercises) ? row.exercises[0] : row.exercises) as { id: string; name: string; type: ExerciseType; muscle_group: string | null }
      if (!map.has(ex.id)) map.set(ex.id, { exercise_id: ex.id, name: ex.name, type: ex.type, muscle_group: ex.muscle_group ?? null, sets: [] })
      map.get(ex.id)!.sets.push({
        id: row.id,
        set_number: row.set_number,
        reps: row.reps,
        weight_kg: row.weight_kg,
        duration_seconds: row.duration_seconds,
        distance_meters: row.distance_meters,
        rpe: row.rpe,
      })
    }

    setWorkout(w)
    setGroups([...map.values()])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Edit ────────────────────────────────────────────────────

  function enterEdit() {
    setEditTitle(workout?.title ?? '')
    setEditDate(workout?.date ?? '')
    setEditColor(workout?.color ?? null)
    setEditGroups(groups.map(g => ({ ...g, sets: g.sets.map(s => toEditSet(s)) })))
    setError(null)
    setEditing(true)
  }

  function updateEditSet(gi: number, si: number, field: keyof SetRow, value: string) {
    setEditGroups(prev =>
      prev.map((g, i) =>
        i !== gi ? g : {
          ...g,
          sets: g.sets.map((s, j) => j !== si ? s : { ...s, [field]: value }),
        }
      )
    )
  }

  function addEditSet(gi: number) {
    setEditGroups(prev =>
      prev.map((g, i) => i !== gi ? g : { ...g, sets: [...g.sets, { id: '', ...emptySet() }] })
    )
  }

  function removeEditSet(gi: number, si: number) {
    setEditGroups(prev =>
      prev.map((g, i) => i !== gi ? g : { ...g, sets: g.sets.filter((_, j) => j !== si) })
    )
  }

  function addExerciseToEdit(exercise: Exercise) {
    setEditGroups(prev => [
      ...prev,
      { exercise_id: exercise.id, name: exercise.name, type: exercise.type, muscle_group: exercise.muscle_group ?? null, sets: [{ id: '', ...emptySet() }] },
    ])
  }

  async function createExercise(data: { name: string; type: Exercise['type']; muscle_group: string | null }): Promise<Exercise> {
    const { data: created, error } = await supabase
      .from('exercises')
      .insert(data)
      .select('id, name, muscle_group, type')
      .single()
    if (error || !created) throw new Error(error?.message ?? 'Failed to create exercise')
    await refetchExercises()
    return created as Exercise
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { error: titleErr } = await supabase
        .from('workouts')
        .update({ title: editTitle.trim() || null, date: editDate, color: editColor })
        .eq('id', id!)
      if (titleErr) throw new Error(titleErr.message)

      const originalIds = new Set(groups.flatMap(g => g.sets.map(s => s.id)))
      const keptIds = new Set(editGroups.flatMap(g => g.sets.map(s => s.id).filter(Boolean)))
      const deletedIds = [...originalIds].filter(sid => !keptIds.has(sid))

      if (deletedIds.length > 0) {
        const { error: delErr } = await supabase.from('workout_sets').delete().in('id', deletedIds)
        if (delErr) throw new Error(delErr.message)
      }

      const allSets = editGroups.flatMap(g =>
        g.sets
          .filter(s => s.reps || s.weight_kg || s.duration_minutes || s.distance_km || s.rpe)
          .map((s, si) => ({
            id: s.id || null,
            workout_id: id!,
            exercise_id: g.exercise_id,
            set_number: si + 1,
            reps: s.reps ? parseInt(s.reps) : null,
            weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
            duration_seconds: s.duration_minutes ? Math.round(parseFloat(s.duration_minutes) * 60) : null,
            distance_meters: s.distance_km ? Math.round(parseFloat(s.distance_km) * 1000) : null,
            rpe: s.rpe ? parseInt(s.rpe) : null,
          }))
      )

      const toUpdate = allSets.filter(s => s.id !== null)
      const toInsert = allSets.filter(s => s.id === null).map(({ id: _id, ...rest }) => rest)

      if (toUpdate.length > 0) {
        const { error: updateErr } = await supabase.from('workout_sets').upsert(toUpdate)
        if (updateErr) throw new Error(updateErr.message)
      }

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from('workout_sets').insert(toInsert)
        if (insertErr) throw new Error(insertErr.message)
      }

      await load()
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Save as template ────────────────────────────────────────

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) { setTemplateError('Enter a name for this template.'); return }
    setSavingTemplate(true)
    setTemplateError(null)
    try {
      const { data: tmpl, error: tmplErr } = await supabase
        .from('workout_templates')
        .insert({ user_id: user!.id, name: templateName.trim(), color: templateColor })
        .select('id')
        .single()
      if (tmplErr) throw tmplErr

      const rows = groups.map((g, i) => ({
        template_id: tmpl.id,
        exercise_id: g.exercise_id,
        order_index: i,
        default_sets: g.sets.length,
      }))
      const { error: exErr } = await supabase.from('workout_template_exercises').insert(rows)
      if (exErr) throw exErr

      setTemplateSaved(true)
      setShowSaveTemplate(false)
      setTemplateName('')
      setTemplateColor(null)
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('workouts').delete().eq('id', id!)
    navigate('/')
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) return null

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-500">Workout not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        {editing ? (
          <>
            <div className="flex items-center gap-2">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Workout title"
                className={`min-w-0 flex-1 text-2xl font-bold ${inputCls}`}
              />
              <ColorSwatch color={editColor} onChange={setEditColor} />
            </div>
            <input
              type="date"
              value={editDate}
              onChange={e => setEditDate(e.target.value)}
              className={`mt-2 ${inputCls}`}
            />
          </>
        ) : (
          <h1 className="text-2xl font-bold text-slate-100">{workout?.title ?? 'Workout'}</h1>
        )}
        {!editing && <p className="mt-1 text-sm text-slate-500">{workout && formatDate(workout.date)}</p>}
      </div>

      {/* Rest day banner */}
      {workout?.is_rest_day && (
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-6 text-center">
          <p className="text-2xl">😴</p>
          <p className="mt-2 font-medium text-slate-200">Rest Day</p>
          <p className="mt-1 text-sm text-slate-500">Recovery counts.</p>
        </div>
      )}

      {/* Exercise groups */}
      {!workout?.is_rest_day && <div className="space-y-4">
        {(editing ? editGroups : groups).map((group, gi) => (
          <div key={group.exercise_id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: getColor(group.muscle_group ?? group.type) }}
                />
                <div>
                  <h2 className="font-semibold text-slate-100">{group.name}</h2>
                  <p className="text-xs text-slate-500">{setTypeLabel(group.type)}</p>
                </div>
              </div>
            </div>

            {editing ? (
              // Edit mode: inputs per set
              <div className="space-y-2">
                {(group as EditGroup).sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs text-slate-600">{si + 1}</span>
                    <SetInputs
                      type={group.type}
                      set={s}
                      onChange={(field, val) => updateEditSet(gi, si, field, val)}
                    />
                    <button
                      onClick={() => removeEditSet(gi, si)}
                      className="text-xs text-slate-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addEditSet(gi)}
                  className="mt-1 text-sm text-blue-500 hover:underline"
                >
                  + Add set
                </button>
              </div>
            ) : (
              // View mode: formatted set list
              <ul className="space-y-1">
                {(group as ExerciseGroup).sets.map((s, si) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-center text-xs text-slate-600">{si + 1}</span>
                    <span className="text-slate-200">{formatSet(s, group.type)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>}

      {!workout?.is_rest_day && editing && (
        <button
          onClick={() => setPickerOpen(true)}
          className="mt-3 w-full rounded-xl border border-dashed border-slate-700 py-3 text-sm font-medium text-slate-400 hover:border-blue-500 hover:text-blue-500"
        >
          + Add exercise
        </button>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* Save as template (view mode, non-rest-day) */}
      {!editing && !workout?.is_rest_day && (
        <div className="mt-6">
          {templateSaved ? (
            <p className="text-sm text-green-400">Template saved!</p>
          ) : showSaveTemplate ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="mb-3 text-sm font-medium text-slate-300">Save as template</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Template name…"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <ColorSwatch color={templateColor} onChange={setTemplateColor} />
                <button
                  onClick={handleSaveAsTemplate}
                  disabled={savingTemplate}
                  className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-blue-600 disabled:opacity-50"
                >
                  {savingTemplate ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateColor(null); setTemplateError(null) }}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
              {templateError && <p className="mt-2 text-xs text-red-400">{templateError}</p>}
            </div>
          ) : (
            <button
              onClick={() => { setTemplateName(workout?.title ?? ''); setShowSaveTemplate(true) }}
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              Save as template
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-8">
        {editing ? (
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : confirmDelete ? (
          <div className="rounded-xl border border-red-900 bg-red-950 p-4">
            <p className="mb-3 text-sm font-medium text-red-400">
              Delete this workout? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              ← Back
            </button>
            <button
              onClick={enterEdit}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto rounded-lg border border-red-800 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          addedIds={new Set(editGroups.map(g => g.exercise_id))}
          onSelect={addExerciseToEdit}
          onCreate={createExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
