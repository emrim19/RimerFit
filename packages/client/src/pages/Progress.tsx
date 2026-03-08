import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Exercise } from '../hooks/useExercises'

// ── Types ─────────────────────────────────────────────────────

type ExerciseType = Exercise['type']

interface LoggedExercise extends Exercise {
  session_count: number
}

interface RawSetRow {
  id: string
  reps: number | null
  weight_kg: number | null
  duration_seconds: number | null
  distance_meters: number | null
  rpe: number | null
  workouts: { id: string; date: string; title: string | null }
}

interface Session {
  workout_id: string
  date: string
  title: string | null
  sets: Omit<RawSetRow, 'workouts'>[]
  bestWeight: number | null
  bestReps: number | null
  bestE1RM: number | null
  totalVolume: number
  bestDuration: number | null
  bestDistance: number | null
}

// ── Data helpers ──────────────────────────────────────────────

function groupIntoSessions(rows: RawSetRow[]): Session[] {
  const map = new Map<string, Session>()
  for (const row of rows) {
    const w = row.workouts
    if (!map.has(w.id)) {
      map.set(w.id, {
        workout_id: w.id, date: w.date, title: w.title,
        sets: [], bestWeight: null, bestReps: null, bestE1RM: null,
        totalVolume: 0, bestDuration: null, bestDistance: null,
      })
    }
    const s = map.get(w.id)!
    const { workouts: _w, ...setData } = row
    s.sets.push(setData)
    if (row.weight_kg) s.bestWeight = Math.max(s.bestWeight ?? 0, row.weight_kg)
    if (row.reps) s.bestReps = Math.max(s.bestReps ?? 0, row.reps)
    if (row.reps && row.weight_kg) {
      s.totalVolume += row.reps * row.weight_kg
      const e1rm = Math.round(row.weight_kg * (1 + row.reps / 30))
      s.bestE1RM = Math.max(s.bestE1RM ?? 0, e1rm)
    }
    if (row.duration_seconds) s.bestDuration = Math.max(s.bestDuration ?? 0, row.duration_seconds)
    if (row.distance_meters) s.bestDistance = Math.max(s.bestDistance ?? 0, row.distance_meters)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function barValue(session: Session, type: ExerciseType): number {
  if (type === 'cardio') return session.bestDuration ?? 0
  if (type === 'bodyweight') return session.bestReps ?? 0
  return session.bestE1RM ?? session.bestWeight ?? 0
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m} min`
}

function formatVolume(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)} kg`
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900 p-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-2xl font-bold text-stone-100">{value}</p>
    </div>
  )
}

function BarChart({ sessions, type }: { sessions: Session[]; type: ExerciseType }) {
  const visible = sessions.slice(-12)
  const max = Math.max(...visible.map(s => barValue(s, type)), 1)

  return (
    <div>
      <div className="flex h-28 items-end gap-1">
        {visible.map(s => {
          const val = barValue(s, type)
          const pct = (val / max) * 100
          return (
            <div
              key={s.workout_id}
              className="flex-1 rounded-t-sm bg-amber-500"
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {visible.map(s => (
          <div key={s.workout_id} className="flex-1 overflow-hidden text-center">
            <span className="text-[10px] text-stone-600">{formatDate(s.date)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatsView({
  exercise,
  sessions,
  onBack,
}: {
  exercise: LoggedExercise
  sessions: Session[]
  onBack: () => void
}) {
  const type = exercise.type
  const recent = [...sessions].reverse()

  const prWeight = sessions.reduce((m, s) => Math.max(m, s.bestWeight ?? 0), 0)
  const prE1RM = sessions.reduce((m, s) => Math.max(m, s.bestE1RM ?? 0), 0)
  const prReps = sessions.reduce((m, s) => Math.max(m, s.bestReps ?? 0), 0)
  const prVolume = sessions.reduce((m, s) => Math.max(m, s.totalVolume), 0)
  const prDuration = sessions.reduce((m, s) => Math.max(m, s.bestDuration ?? 0), 0)
  const prDistance = sessions.reduce((m, s) => Math.max(m, s.bestDistance ?? 0), 0)

  return (
    <div>
      <div className="mb-6">
        <button onClick={onBack} className="mb-3 text-sm text-stone-500 hover:text-stone-200">
          ← Change exercise
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-stone-100">{exercise.name}</h2>
          <span className="rounded-full border border-stone-700 px-2 py-0.5 text-xs capitalize text-stone-500">
            {exercise.type}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-stone-500">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} logged
        </p>
      </div>

      {/* PR cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {type === 'strength' && (
          <>
            <StatCard label="Est. 1RM (Epley)" value={prE1RM ? `${prE1RM} kg` : '—'} />
            <StatCard label="Best weight" value={prWeight ? `${prWeight} kg` : '—'} />
            <StatCard label="Best session volume" value={prVolume ? formatVolume(prVolume) : '—'} />
          </>
        )}
        {type === 'cardio' && (
          <>
            <StatCard label="Best duration" value={prDuration ? formatDuration(prDuration) : '—'} />
            <StatCard label="Best distance" value={prDistance ? `${(prDistance / 1000).toFixed(1)} km` : '—'} />
            <StatCard label="Total sessions" value={String(sessions.length)} />
          </>
        )}
        {type === 'bodyweight' && (
          <>
            <StatCard label="Best set" value={prReps ? `${prReps} reps` : '—'} />
            <StatCard label="Total sessions" value={String(sessions.length)} />
          </>
        )}
      </div>

      {/* Chart */}
      {sessions.length > 1 && (
        <div className="mb-6 rounded-xl border border-stone-700 bg-stone-900 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {type === 'strength' ? 'Est. 1RM per session (Epley)' : type === 'cardio' ? 'Duration per session' : 'Best reps per session'}
          </p>
          <BarChart sessions={sessions} type={type} />
        </div>
      )}

      {/* Session history */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Sessions</p>
        <ul className="space-y-2">
          {recent.map(s => (
            <li key={s.workout_id}>
              <Link
                to={`/workout/${s.workout_id}`}
                className="flex items-center justify-between rounded-xl border border-stone-700 bg-stone-900 px-4 py-3 transition-colors hover:border-stone-600 hover:bg-stone-800"
              >
                <div>
                  <p className="font-medium text-stone-100">{s.title ?? 'Workout'}</p>
                  <p className="text-sm text-stone-500">{formatDate(s.date)}</p>
                </div>
                <div className="text-right">
                  {type === 'strength' && (
                    <>
                      {s.bestE1RM && <p className="text-sm font-medium text-stone-200">{s.bestE1RM} kg e1RM</p>}
                      {s.bestWeight && <p className="text-xs text-stone-500">{s.bestWeight} kg top set</p>}
                    </>
                  )}
                  {type === 'cardio' && s.bestDuration && (
                    <p className="text-sm font-medium text-stone-300">{formatDuration(s.bestDuration)}</p>
                  )}
                  {type === 'bodyweight' && s.bestReps && (
                    <p className="text-sm font-medium text-stone-300">{s.bestReps} reps</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ExerciseSelector({
  exercises,
  loading,
  onSelect,
}: {
  exercises: LoggedExercise[]
  loading: boolean
  onSelect: (ex: LoggedExercise) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search exercises…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {loading && <p className="text-sm text-stone-500">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-500">
          {search ? 'No exercises found.' : 'No exercises logged yet — start by logging a workout.'}
        </p>
      )}

      <ul className="space-y-2">
        {filtered.map(ex => (
          <li key={ex.id}>
            <button
              onClick={() => onSelect(ex)}
              className="flex w-full items-center justify-between rounded-xl border border-stone-700 bg-stone-900 px-4 py-3 text-left transition-colors hover:border-stone-600 hover:bg-stone-800"
            >
              <div>
                <p className="font-medium text-stone-100">{ex.name}</p>
                <p className="text-sm capitalize text-stone-500">
                  {ex.muscle_group ?? ex.type}
                </p>
              </div>
              <span className="text-sm text-stone-500">
                {ex.session_count} {ex.session_count === 1 ? 'session' : 'sessions'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function Progress() {
  const [exercises, setExercises] = useState<LoggedExercise[]>([])
  const [exercisesLoading, setExercisesLoading] = useState(true)

  const [selected, setSelected] = useState<LoggedExercise | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('workout_sets')
      .select('exercise_id, workout_id, exercises(id, name, type, muscle_group)')
      .then(({ data }) => {
        if (!data) { setExercisesLoading(false); return }

        const sessionMap = new Map<string, Set<string>>()
        const exerciseMap = new Map<string, Exercise>()

        for (const row of data) {
          const ex = row.exercises as unknown as Exercise
          if (!ex) continue
          if (!sessionMap.has(ex.id)) {
            sessionMap.set(ex.id, new Set())
            exerciseMap.set(ex.id, ex)
          }
          sessionMap.get(ex.id)!.add(row.workout_id)
        }

        const result: LoggedExercise[] = [...exerciseMap.values()]
          .map(ex => ({ ...ex, session_count: sessionMap.get(ex.id)!.size }))
          .sort((a, b) => a.name.localeCompare(b.name))

        setExercises(result)
        setExercisesLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selected) return
    setStatsLoading(true)
    supabase
      .from('workout_sets')
      .select('id, reps, weight_kg, duration_seconds, distance_meters, rpe, workouts(id, date, title)')
      .eq('exercise_id', selected.id)
      .then(({ data }) => {
        setSessions(groupIntoSessions((data ?? []) as unknown as RawSetRow[]))
        setStatsLoading(false)
      })
  }, [selected])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-stone-100">Progress</h1>

      {!selected ? (
        <ExerciseSelector
          exercises={exercises}
          loading={exercisesLoading}
          onSelect={ex => { setSelected(ex); setSessions([]) }}
        />
      ) : statsLoading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <StatsView
          exercise={selected}
          sessions={sessions}
          onBack={() => setSelected(null)}
        />
      )}
    </div>
  )
}
