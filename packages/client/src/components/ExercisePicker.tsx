import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Exercise } from '../hooks/useExercises'

const GROUP_ORDER = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'cardio']
const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core']

function groupKey(exercise: Exercise): string {
  return exercise.muscle_group?.toLowerCase() ?? 'cardio'
}

function groupExercises(exercises: Exercise[]): [string, Exercise[]][] {
  const map = new Map<string, Exercise[]>()
  for (const ex of exercises) {
    const key = groupKey(ex)
    const group = map.get(key) ?? []
    group.push(ex)
    map.set(key, group)
  }
  return [...map.entries()].sort(([a], [b]) => {
    const ai = GROUP_ORDER.indexOf(a)
    const bi = GROUP_ORDER.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

interface CreateData {
  name: string
  type: Exercise['type']
  muscle_group: string | null
}

interface Props {
  exercises: Exercise[]
  addedIds: Set<string>
  onSelect: (exercise: Exercise) => void
  onCreate: (data: CreateData) => Promise<Exercise>
  onClose: () => void
}

export default function ExercisePicker({ exercises, addedIds, onSelect, onCreate, onClose }: Props) {
  const [mode, setMode] = useState<'browse' | 'create'>('browse')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mode === 'create') setMode('browse')
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full flex-col rounded-t-2xl bg-stone-900 sm:h-[70vh] sm:max-w-md sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {mode === 'browse' ? (
          <BrowseView
            exercises={exercises}
            addedIds={addedIds}
            onSelect={ex => { onSelect(ex); onClose() }}
            onClose={onClose}
            onCreateClick={() => setMode('create')}
          />
        ) : (
          <CreateView
            onCreate={async data => {
              const exercise = await onCreate(data)
              onSelect(exercise)
              onClose()
            }}
            onBack={() => setMode('browse')}
          />
        )}
      </div>
    </div>
  )
}

// ── Browse view ────────────────────────────────────────────────

function BrowseView({
  exercises,
  addedIds,
  onSelect,
  onClose,
  onCreateClick,
}: {
  exercises: Exercise[]
  addedIds: Set<string>
  onSelect: (ex: Exercise) => void
  onClose: () => void
  onCreateClick: () => void
}) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const filtered = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises

  const groups = groupExercises(filtered)

  return (
    <>
      <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
        <h2 className="font-semibold text-stone-100">Add exercise</h2>
        <button onClick={onClose} className="text-stone-500 hover:text-stone-200">✕</button>
      </div>

      <div className="px-4 py-3">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-500">No exercises found.</p>
        )}
        {groups.map(([group, exs]) => (
          <div key={group} className="mb-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 capitalize">
              {group}
            </p>
            <ul className="space-y-1">
              {exs.map(ex => {
                const added = addedIds.has(ex.id)
                return (
                  <li key={ex.id}>
                    <button
                      disabled={added}
                      onClick={() => onSelect(ex)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        added ? 'cursor-default text-stone-600' : 'text-stone-100 hover:bg-stone-800'
                      }`}
                    >
                      <span>{ex.name}</span>
                      {added && <span className="text-xs text-stone-600">Added</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-stone-800 px-4 py-3">
        <button
          onClick={onCreateClick}
          className="w-full rounded-lg border border-dashed border-stone-700 py-2 text-sm font-medium text-stone-400 hover:border-amber-500 hover:text-amber-500"
        >
          + Create custom exercise
        </button>
      </div>
    </>
  )
}

// ── Create view ────────────────────────────────────────────────

function CreateView({
  onCreate,
  onBack,
}: {
  onCreate: (data: CreateData) => Promise<void>
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<Exercise['type']>('strength')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isCardio = type === 'cardio'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      await onCreate({
        name: name.trim(),
        type,
        muscle_group: isCardio ? null : (muscleGroup.trim().toLowerCase() || null),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-stone-800 px-4 py-3">
        <button onClick={onBack} className="text-stone-500 hover:text-stone-200">←</button>
        <h2 className="font-semibold text-stone-100">Create exercise</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-200">Name</label>
          <input
            type="text"
            placeholder="e.g. Cable Fly"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-200">Type</label>
          <div className="flex gap-2">
            {(['strength', 'bodyweight', 'cardio'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-colors ${
                  type === t
                    ? 'border-amber-500 bg-amber-950 text-amber-400'
                    : 'border-stone-700 text-stone-400 hover:border-stone-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {!isCardio && (
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-200">
              Muscle group <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input
              list="muscle-group-options"
              placeholder="e.g. chest, back, legs…"
              value={muscleGroup}
              onChange={e => setMuscleGroup(e.target.value)}
              className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            <datalist id="muscle-group-options">
              {MUSCLE_GROUPS.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-auto w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save exercise'}
        </button>
      </form>
    </>
  )
}
