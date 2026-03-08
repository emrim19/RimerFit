import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Exercise } from '../hooks/useExercises'
import { useMuscleGroupColors } from '../hooks/useMuscleGroupColors'
import { useMuscleGroups } from '../hooks/useMuscleGroups'
import type { MuscleGroup } from '../hooks/useMuscleGroups'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#3b82f6', '#0ea5e9',
  '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
]

function groupKey(exercise: Exercise): string {
  return exercise.muscle_group?.toLowerCase() ?? 'cardio'
}

function groupExercises(exercises: Exercise[], orderedNames: string[]): [string, Exercise[]][] {
  const map = new Map<string, Exercise[]>()
  for (const ex of exercises) {
    const key = groupKey(ex)
    const group = map.get(key) ?? []
    group.push(ex)
    map.set(key, group)
  }
  return [...map.entries()].sort(([a], [b]) => {
    const ai = orderedNames.indexOf(a)
    const bi = orderedNames.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

// ── Color dot with swatch picker ──────────────────────────────

function ColorDot({
  group,
  getColor,
  setColor,
}: {
  group: string
  getColor: (g: string) => string
  setColor: (g: string, c: string) => void
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
        title="Change colour"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="h-3.5 w-3.5 rounded-full ring-2 ring-white/10 transition-all hover:scale-110 hover:ring-white/30"
        style={{ backgroundColor: getColor(group) }}
      />
      {open && (
        <div
          className="absolute left-0 top-6 z-10 w-48 rounded-2xl border border-slate-700 bg-slate-800/95 p-4 shadow-2xl backdrop-blur-sm"
          onClick={e => e.stopPropagation()}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">
            {group}
          </p>
          <div className="grid grid-cols-4 gap-2.5">
            {PRESET_COLORS.map(c => {
              const active = getColor(group) === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setColor(group, c); setOpen(false) }}
                  className="h-8 w-8 rounded-xl transition-all hover:scale-110"
                  style={{
                    backgroundColor: c,
                    boxShadow: active ? `0 0 0 3px #1e293b, 0 0 0 5px ${c}` : undefined,
                  }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────

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
  const [mode, setMode] = useState<'browse' | 'create' | 'manage'>('browse')
  const muscleGroupsHook = useMuscleGroups()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mode !== 'browse') setMode('browse')
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
        className="flex h-[80vh] w-full flex-col rounded-t-2xl bg-slate-900 sm:h-[70vh] sm:max-w-md sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {mode === 'browse' && (
          <BrowseView
            exercises={exercises}
            addedIds={addedIds}
            muscleGroups={muscleGroupsHook.groups}
            onSelect={ex => { onSelect(ex); onClose() }}
            onClose={onClose}
            onCreateClick={() => setMode('create')}
            onManageClick={() => setMode('manage')}
          />
        )}
        {mode === 'create' && (
          <CreateView
            muscleGroupNames={muscleGroupsHook.groups.map(g => g.name)}
            onCreate={async data => {
              const exercise = await onCreate(data)
              onSelect(exercise)
              onClose()
            }}
            onBack={() => setMode('browse')}
          />
        )}
        {mode === 'manage' && (
          <ManageGroupsView
            {...muscleGroupsHook}
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
  muscleGroups,
  onSelect,
  onClose,
  onCreateClick,
  onManageClick,
}: {
  exercises: Exercise[]
  addedIds: Set<string>
  muscleGroups: MuscleGroup[]
  onSelect: (ex: Exercise) => void
  onClose: () => void
  onCreateClick: () => void
  onManageClick: () => void
}) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { getColor, setColor } = useMuscleGroupColors()

  useEffect(() => { searchRef.current?.focus() }, [])

  const orderedNames = muscleGroups.map(g => g.name)
  const filtered = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises
  const groups = groupExercises(filtered, orderedNames)

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-100">Add exercise</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200">✕</button>
      </div>

      <div className="px-4 py-3">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No exercises found.</p>
        )}
        {groups.map(([group, exs]) => (
          <div key={group} className="mb-4">
            <div className="mb-1 flex items-center gap-2">
              <ColorDot group={group} getColor={getColor} setColor={setColor} />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 capitalize">
                {group}
              </p>
            </div>
            <ul className="space-y-1">
              {exs.map(ex => {
                const added = addedIds.has(ex.id)
                return (
                  <li key={ex.id}>
                    <button
                      disabled={added}
                      onClick={() => onSelect(ex)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        added ? 'cursor-default text-slate-600' : 'text-slate-100 hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: added ? '#475569' : getColor(group) }}
                      />
                      <span className="flex-1">{ex.name}</span>
                      {added && <span className="text-xs text-slate-600">Added</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-slate-800 px-4 py-3">
        <button
          onClick={onCreateClick}
          className="flex-1 rounded-lg border border-dashed border-slate-700 py-2 text-sm font-medium text-slate-400 hover:border-blue-500 hover:text-blue-500"
        >
          + Create exercise
        </button>
        <button
          onClick={onManageClick}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-400 hover:border-slate-600 hover:text-slate-200"
        >
          Manage groups
        </button>
      </div>
    </>
  )
}

// ── Manage groups view ─────────────────────────────────────────

function ManageGroupsView({
  groups,
  loading,
  addGroup,
  renameGroup,
  deleteGroup,
  onBack,
}: {
  groups: MuscleGroup[]
  loading: boolean
  addGroup: (name: string) => Promise<void>
  renameGroup: (id: string, name: string) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  onBack: () => void
}) {
  const { getColor, setColor } = useMuscleGroupColors()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const newInputRef = useRef<HTMLInputElement>(null)

  const defaults = groups.filter(g => g.user_id === null)
  const custom = groups.filter(g => g.user_id !== null)

  function startEdit(g: MuscleGroup) {
    setEditingId(g.id)
    setEditName(g.name)
    setDeletingId(null)
  }

  async function confirmRename(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    await renameGroup(id, editName.trim())
    setSaving(false)
    setEditingId(null)
  }

  async function confirmDelete(id: string) {
    await deleteGroup(id)
    setDeletingId(null)
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    await addGroup(newName.trim())
    setSaving(false)
    setNewName('')
    setAdding(false)
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-200">←</button>
        <h2 className="font-semibold text-slate-100">Manage muscle groups</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            {/* Defaults */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Default
            </p>
            <ul className="mb-6 space-y-1">
              {defaults.map(g => (
                <li
                  key={g.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                >
                  <ColorDot group={g.name} getColor={getColor} setColor={setColor} />
                  <span className="flex-1 text-sm capitalize text-slate-300">{g.name}</span>
                  <span className="text-xs text-slate-600">Default</span>
                </li>
              ))}
            </ul>

            {/* Custom */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Custom
            </p>
            {custom.length === 0 && (
              <p className="mb-4 text-sm text-slate-600">No custom groups yet.</p>
            )}
            <ul className="mb-4 space-y-1">
              {custom.map(g => (
                <li key={g.id} className="rounded-lg border border-slate-800 bg-slate-800/40">
                  {deletingId === g.id ? (
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="flex-1 text-sm text-slate-400">Delete "{g.name}"?</span>
                      <button
                        onClick={() => confirmDelete(g.id)}
                        className="text-xs font-medium text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="text-xs text-slate-500 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : editingId === g.id ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <ColorDot group={g.name} getColor={getColor} setColor={setColor} />
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmRename(g.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-sm text-slate-100 outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => confirmRename(g.id)}
                        disabled={saving}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-slate-500 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <ColorDot group={g.name} getColor={getColor} setColor={setColor} />
                      <span className="flex-1 text-sm capitalize text-slate-200">{g.name}</span>
                      <button
                        onClick={() => startEdit(g)}
                        className="text-xs text-slate-500 hover:text-slate-300"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => { setDeletingId(g.id); setEditingId(null) }}
                        className="text-xs text-slate-500 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Add new */}
            {adding ? (
              <div className="flex items-center gap-2">
                <input
                  ref={newInputRef}
                  autoFocus
                  type="text"
                  placeholder="Group name…"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAdd()
                    if (e.key === 'Escape') { setAdding(false); setNewName('') }
                  }}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAdding(false); setNewName('') }}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full rounded-lg border border-dashed border-slate-700 py-2.5 text-sm font-medium text-slate-400 hover:border-blue-500 hover:text-blue-500"
              >
                + Add custom group
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ── Create view ────────────────────────────────────────────────

function CreateView({
  muscleGroupNames,
  onCreate,
  onBack,
}: {
  muscleGroupNames: string[]
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
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-200">←</button>
        <h2 className="font-semibold text-slate-100">Create exercise</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-200">Name</label>
          <input
            type="text"
            placeholder="e.g. Cable Fly"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-200">Type</label>
          <div className="flex gap-2">
            {(['strength', 'bodyweight', 'cardio'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-colors ${
                  type === t
                    ? 'border-blue-500 bg-blue-950 text-blue-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {!isCardio && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Muscle group <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              list="muscle-group-options"
              placeholder="e.g. chest, back, legs…"
              value={muscleGroup}
              onChange={e => setMuscleGroup(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <datalist id="muscle-group-options">
              {muscleGroupNames.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-auto w-full rounded-lg bg-blue-500 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save exercise'}
        </button>
      </form>
    </>
  )
}
