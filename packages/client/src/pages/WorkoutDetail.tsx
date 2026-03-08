import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SetInputs, emptySet, setTypeLabel, inputCls } from '../components/SetInputs'
import type { SetRow, ExerciseType } from '../components/SetInputs'
import ExercisePicker from '../components/ExercisePicker'
import { useExercises } from '../hooks/useExercises'
import type { Exercise } from '../hooks/useExercises'

// ── Data types ────────────────────────────────────────────────

interface WorkoutMeta {
  id: string
  title: string | null
  date: string
  duration_minutes: number | null
  is_rest_day: boolean
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

  const [workout, setWorkout] = useState<WorkoutMeta | null>(null)
  const [groups, setGroups] = useState<ExerciseGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editGroups, setEditGroups] = useState<EditGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const { exercises, refetch: refetchExercises } = useExercises()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: w, error: wErr }, { data: setsData, error: sErr }] = await Promise.all([
      supabase.from('workouts').select('id, title, date, duration_minutes, is_rest_day').eq('id', id!).single(),
      supabase
        .from('workout_sets')
        .select('id, set_number, reps, weight_kg, duration_seconds, distance_meters, rpe, exercises(id, name, type)')
        .eq('workout_id', id!)
        .order('set_number'),
    ])

    if (wErr || !w) { setNotFound(true); setLoading(false); return }
    if (sErr) { setError(sErr.message); setLoading(false); return }

    const map = new Map<string, ExerciseGroup>()
    for (const row of setsData ?? []) {
      const ex = (Array.isArray(row.exercises) ? row.exercises[0] : row.exercises) as { id: string; name: string; type: ExerciseType }
      if (!map.has(ex.id)) map.set(ex.id, { exercise_id: ex.id, name: ex.name, type: ex.type, sets: [] })
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
      { exercise_id: exercise.id, name: exercise.name, type: exercise.type, sets: [{ id: '', ...emptySet() }] },
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
        .update({ title: editTitle.trim() || null })
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
        <p className="text-gray-500">Workout not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        {editing ? (
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Workout title"
            className={`w-full text-2xl font-bold ${inputCls}`}
          />
        ) : (
          <h1 className="text-2xl font-bold text-gray-900">{workout?.title ?? 'Workout'}</h1>
        )}
        <p className="mt-1 text-sm text-gray-500">{workout && formatDate(workout.date)}</p>
      </div>

      {/* Rest day banner */}
      {workout?.is_rest_day && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center">
          <p className="text-2xl">😴</p>
          <p className="mt-2 font-medium text-gray-700">Rest Day</p>
          <p className="mt-1 text-sm text-gray-400">Recovery counts.</p>
        </div>
      )}

      {/* Exercise groups */}
      {!workout?.is_rest_day && <div className="space-y-4">
        {(editing ? editGroups : groups).map((group, gi) => (
          <div key={group.exercise_id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{group.name}</h2>
                <p className="text-xs text-gray-400">{setTypeLabel(group.type)}</p>
              </div>
            </div>

            {editing ? (
              // Edit mode: inputs per set
              <div className="space-y-2">
                {(group as EditGroup).sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs text-gray-400">{si + 1}</span>
                    <SetInputs
                      type={group.type}
                      set={s}
                      onChange={(field, val) => updateEditSet(gi, si, field, val)}
                    />
                    <button
                      onClick={() => removeEditSet(gi, si)}
                      className="text-xs text-gray-300 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addEditSet(gi)}
                  className="mt-1 text-sm text-blue-600 hover:underline"
                >
                  + Add set
                </button>
              </div>
            ) : (
              // View mode: formatted set list
              <ul className="space-y-1">
                {(group as ExerciseGroup).sets.map((s, si) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-center text-xs text-gray-400">{si + 1}</span>
                    <span className="text-gray-800">{formatSet(s, group.type)}</span>
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
          className="mt-3 w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-500"
        >
          + Add exercise
        </button>
      )}

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {/* Actions */}
      <div className="mt-8">
        {editing ? (
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : confirmDelete ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="mb-3 text-sm font-medium text-red-700">
              Delete this workout? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
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
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={enterEdit}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
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
