import { useState } from 'react'
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

type ExerciseType = Exercise['type']

interface ExerciseEntry {
  exercise_id: string
  name: string
  type: ExerciseType
  sets: SetRow[]
}

export default function LogWorkout() {
  const { user } = useAuth()
  const { exercises, refetch } = useExercises()
  const { templates, refetch: refetchTemplates } = useTemplates()
  const navigate = useNavigate()

  const [isRestDay, setIsRestDay] = useState(false)
  const [title, setTitle] = useState('')
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
    setEntries(
      template.exercises.map(te => ({
        exercise_id: te.exercise_id,
        name: te.name,
        type: te.type,
        sets: Array.from({ length: te.default_sets }, () => emptySet()),
      }))
    )
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
    return set.reps // bodyweight
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
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Log workout</h1>

      {/* Type selector */}
      <div className="mb-6 flex gap-2">
        {(['workout', 'rest'] as const).map(type => (
          <button
            key={type}
            onClick={() => setIsRestDay(type === 'rest')}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
              (type === 'rest') === isRestDay
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {type === 'workout' ? 'Workout' : 'Rest Day'}
          </button>
        ))}
      </div>

      {/* Title */}
      <div className="mb-4">
        <input
          type="text"
          placeholder={isRestDay ? 'Note (optional)' : 'Workout title (optional)'}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Use template button (workout mode only) */}
      {!isRestDay && (
        <div className="mb-6">
          <button
            onClick={() => setTemplatePickerOpen(true)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Use template
          </button>
        </div>
      )}

      {isRestDay && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-6 text-center">
          <p className="text-2xl">😴</p>
          <p className="mt-2 font-medium text-gray-700">Rest Day</p>
          <p className="mt-1 text-sm text-gray-400">Recovery counts — this will keep your streak alive.</p>
        </div>
      )}

      {/* Exercise entries */}
      {!isRestDay && (
        <div className="space-y-4">
          {entries.map((entry, ei) => (
            <div key={entry.exercise_id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{entry.name}</h2>
                  <p className="text-xs text-gray-400">{setTypeLabel(entry.type)}</p>
                </div>
                <button
                  onClick={() => removeExercise(ei)}
                  className="text-sm text-gray-400 hover:text-red-500"
                >
                  Remove
                </button>
              </div>

              <div className="mb-2 space-y-2">
                {entry.sets.map((set, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs text-gray-400">{si + 1}</span>
                    <SetInputs
                      type={entry.type}
                      set={set}
                      onChange={(field, value) => updateSet(ei, si, field, value)}
                    />
                    {entry.sets.length > 1 && (
                      <button
                        onClick={() => removeSet(ei, si)}
                        className="text-xs text-gray-300 hover:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={() => addSet(ei)} className="text-sm text-blue-600 hover:underline">
                + Add set
              </button>
            </div>
          ))}
        </div>
      )}

      {!isRestDay && (
        <>
          {/* Add exercise */}
          <button
            onClick={() => setPickerOpen(true)}
            className="mt-4 w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-500"
          >
            + Add exercise
          </button>

          {/* Save as template */}
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
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingTemplate ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateError(null) }}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveTemplate(true)}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Save as template
                </button>
              )}
              {templateError && <p className="mt-1 text-xs text-red-500">{templateError}</p>}
            </div>
          )}

          {pickerOpen && (
            <ExercisePicker
              exercises={exercises}
              addedIds={addedIds}
              onSelect={addExercise}
              onCreate={handleCreateExercise}
              onClose={() => setPickerOpen(false)}
            />
          )}

          {templatePickerOpen && (
            <TemplatePicker
              templates={templates}
              onSelect={loadTemplate}
              onDelete={handleDeleteTemplate}
              onClose={() => setTemplatePickerOpen(false)}
            />
          )}
        </>
      )}

      {/* Error + save */}
      <div className="mt-8 space-y-3">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isRestDay ? 'Log rest day' : 'Save workout'}
          </button>
        </div>
      </div>
    </div>
  )
}
