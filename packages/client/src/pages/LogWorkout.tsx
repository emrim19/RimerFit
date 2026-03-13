import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useExercises } from '../hooks/useExercises'
import type { Exercise } from '../hooks/useExercises'
import { useTemplates } from '../hooks/useTemplates'
import type { WorkoutTemplate } from '../hooks/useTemplates'
import ExercisePicker from '../components/ExercisePicker'
import TemplatePicker from '../components/TemplatePicker'
import { SetInputs, emptySet, setTypeLabel } from '../components/SetInputs'
import type { SetRow } from '../components/SetInputs'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb923c', '#fbbf24',
  '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#2563eb', '#64748b',
]

function WorkoutColorDot({
  color,
  onChange,
}: {
  color: string | null
  onChange: (c: string | null) => void
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
    <div ref={ref} className="relative">
      <button
        type="button"
        title={color ? 'Change workout colour' : 'Add workout colour'}
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 transition-colors hover:border-slate-500"
      >
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: color ?? '#334155' }}
        />
      </button>
      {open && (
        <div
          ref={null}
          className="absolute left-0 top-10 z-20 w-56 rounded-2xl border border-slate-700 bg-slate-800/95 p-3 shadow-2xl backdrop-blur-sm"
          onClick={e => e.stopPropagation()}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Workout colour</p>
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

type ExerciseType = Exercise['type']

interface ExerciseEntry {
  exercise_id: string
  name: string
  type: ExerciseType
  sets: SetRow[]
}

export default function LogWorkout() {
  const { user } = useAuth()
  const { exercises, refetch, editExercise, deleteExercise } = useExercises()
  const { templates, refetch: refetchTemplates } = useTemplates()
  const navigate = useNavigate()

  const [isRestDay, setIsRestDay] = useState(false)
  const [title, setTitle] = useState('')
  const [workoutColor, setWorkoutColor] = useState<string | null>(null)
  const [entries, setEntries] = useState<ExerciseEntry[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Save-as-template state
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const addedIds = new Set(entries.map(e => e.exercise_id))

  // ── Template actions ────────────────────────────────────────

  function loadTemplate(template: WorkoutTemplate) {
    if (template.color) setWorkoutColor(template.color)
    setEntries(
      template.exercises.map(te => ({
        exercise_id: te.exercise_id,
        name: te.name,
        type: te.type,
        sets: Array.from({ length: te.default_sets }, () => emptySet()),
      }))
    )
  }

  async function handleTemplateColorChange(id: string, color: string) {
    await supabase.from('workout_templates').update({ color }).eq('id', id)
    await refetchTemplates()
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      setTemplateError('Enter a name for this template.')
      return
    }
    setSavingTemplate(true)
    setTemplateError(null)
    try {
      const { data: tmpl, error: tmplErr } = await supabase
        .from('workout_templates')
        .insert({ user_id: user!.id, name: templateName.trim() })
        .select('id')
        .single()
      if (tmplErr) throw tmplErr

      const exerciseRows = entries.map((entry, i) => ({
        template_id: tmpl.id,
        exercise_id: entry.exercise_id,
        order_index: i,
        default_sets: entry.sets.length,
      }))
      const { error: exErr } = await supabase.from('workout_template_exercises').insert(exerciseRows)
      if (exErr) throw exErr

      await refetchTemplates()
      setShowSaveTemplate(false)
      setTemplateName('')
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  async function handleDeleteTemplate(id: string) {
    await supabase.from('workout_templates').delete().eq('id', id)
    await refetchTemplates()
  }

  // ── Exercise actions ────────────────────────────────────────

  function addExercise(exercise: Exercise) {
    setEntries(prev => [
      ...prev,
      { exercise_id: exercise.id, name: exercise.name, type: exercise.type, sets: [emptySet()] },
    ])
  }

  async function handleCreateExercise(data: {
    name: string
    type: Exercise['type']
    muscle_group: string | null
  }): Promise<Exercise> {
    const { data: exercise, error } = await supabase
      .from('exercises')
      .insert({ ...data, user_id: user!.id })
      .select('id, name, muscle_group, type')
      .single()
    if (error) throw error
    await refetch()
    return exercise as Exercise
  }

  function removeExercise(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  function addSet(exerciseIndex: number) {
    setEntries(prev =>
      prev.map((entry, i) =>
        i === exerciseIndex ? { ...entry, sets: [...entry.sets, emptySet()] } : entry
      )
    )
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setEntries(prev =>
      prev.map((entry, i) =>
        i === exerciseIndex
          ? { ...entry, sets: entry.sets.filter((_, si) => si !== setIndex) }
          : entry
      )
    )
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: keyof SetRow, value: string) {
    setEntries(prev =>
      prev.map((entry, i) =>
        i === exerciseIndex
          ? {
              ...entry,
              sets: entry.sets.map((s, si) => (si === setIndex ? { ...s, [field]: value } : s)),
            }
          : entry
      )
    )
  }

  function hasData(set: SetRow, type: ExerciseType) {
    if (type === 'strength') return set.reps || set.weight_kg
    if (type === 'cardio') return set.duration_minutes || set.distance_km
    return set.reps
  }

  // ── Save workout ────────────────────────────────────────────

  async function handleSave() {
    if (!isRestDay && entries.length === 0) {
      setError('Add at least one exercise before saving.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: workout, error: workoutErr } = await supabase
        .from('workouts')
        .insert({
          user_id: user!.id,
          title: title.trim() || null,
          date: new Date().toISOString().slice(0, 10),
          is_rest_day: isRestDay,
          color: workoutColor,
        })
        .select('id')
        .single()

      if (workoutErr) throw workoutErr

      const sets = entries.flatMap(entry =>
        entry.sets
          .filter(s => hasData(s, entry.type))
          .map((s, si) => ({
            workout_id: workout.id,
            exercise_id: entry.exercise_id,
            set_number: si + 1,
            reps: s.reps ? parseInt(s.reps) : null,
            weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
            duration_seconds: s.duration_minutes ? Math.round(parseFloat(s.duration_minutes) * 60) : null,
            distance_meters: s.distance_km ? Math.round(parseFloat(s.distance_km) * 1000) : null,
            rpe: s.rpe ? parseInt(s.rpe) : null,
          }))
      )

      if (sets.length > 0) {
        const { error: setsErr } = await supabase.from('workout_sets').insert(sets)
        if (setsErr) throw setsErr
      }

      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout')
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-100">Log workout</h1>

      {/* Type selector */}
      <div className="mb-6 flex gap-2">
        {(['workout', 'rest'] as const).map(type => (
          <button
            key={type}
            onClick={() => setIsRestDay(type === 'rest')}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
              (type === 'rest') === isRestDay
                ? 'border-blue-500 bg-blue-950 text-blue-400'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {type === 'workout' ? 'Workout' : 'Rest Day'}
          </button>
        ))}
      </div>

      {/* Title + color */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          placeholder={isRestDay ? 'Note (optional)' : 'Workout title (optional)'}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <WorkoutColorDot color={workoutColor} onChange={setWorkoutColor} />
      </div>

      {/* Use template button (workout mode only) */}
      {!isRestDay && (
        <div className="mb-6">
          <button
            onClick={() => setTemplatePickerOpen(true)}
            className="text-sm font-medium text-blue-500 hover:underline"
          >
            Use template
          </button>
        </div>
      )}

      {isRestDay && (
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 px-4 py-6 text-center">
          <p className="text-2xl">😴</p>
          <p className="mt-2 font-medium text-slate-200">Rest Day</p>
          <p className="mt-1 text-sm text-slate-500">Recovery counts — this will keep your streak alive.</p>
        </div>
      )}

      {/* Exercise entries */}
      {!isRestDay && (
        <div className="space-y-4">
          {entries.map((entry, ei) => (
            <div key={entry.exercise_id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-100">{entry.name}</h2>
                  <p className="text-xs text-slate-500">{setTypeLabel(entry.type)}</p>
                </div>
                <button
                  onClick={() => removeExercise(ei)}
                  className="text-sm text-slate-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>

              <div className="mb-2 space-y-2">
                {entry.sets.map((set, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs text-slate-600">{si + 1}</span>
                    <SetInputs
                      type={entry.type}
                      set={set}
                      onChange={(field, value) => updateSet(ei, si, field, value)}
                    />
                    {entry.sets.length > 1 && (
                      <button
                        onClick={() => removeSet(ei, si)}
                        className="text-xs text-slate-600 hover:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={() => addSet(ei)} className="text-sm text-blue-500 hover:underline">
                + Add set
              </button>
            </div>
          ))}
        </div>
      )}

      {!isRestDay && (
        <>
          <button
            onClick={() => setPickerOpen(true)}
            className="mt-4 w-full rounded-xl border-2 border-dashed border-slate-700 py-3 text-sm font-medium text-slate-400 hover:border-blue-500 hover:text-blue-500"
          >
            + Add exercise
          </button>

          {entries.length > 0 && (
            <div className="mt-3">
              {showSaveTemplate ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Template name…"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-blue-600 disabled:opacity-50"
                  >
                    {savingTemplate ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateError(null) }}
                    className="text-sm text-slate-500 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveTemplate(true)}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  Save as template
                </button>
              )}
              {templateError && <p className="mt-1 text-xs text-red-400">{templateError}</p>}
            </div>
          )}

          {pickerOpen && (
            <ExercisePicker
              exercises={exercises}
              addedIds={addedIds}
              onSelect={addExercise}
              onCreate={handleCreateExercise}
              onEdit={editExercise}
              onDelete={deleteExercise}
              onClose={() => setPickerOpen(false)}
            />
          )}

          {templatePickerOpen && (
            <TemplatePicker
              templates={templates}
              onSelect={loadTemplate}
              onDelete={handleDeleteTemplate}
              onColorChange={handleTemplateColorChange}
              onClose={() => setTemplatePickerOpen(false)}
            />
          )}
        </>
      )}

      {/* Error + save */}
      <div className="mt-8 space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isRestDay ? 'Log rest day' : 'Save workout'}
          </button>
        </div>
      </div>
    </div>
  )
}
