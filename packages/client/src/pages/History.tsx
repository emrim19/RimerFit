import { Link } from 'react-router-dom'
import { useWorkouts } from '../hooks/useWorkouts'
import type { Workout } from '../hooks/useWorkouts'

function formatDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function monthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function groupByMonth(workouts: Workout[]): [string, Workout[]][] {
  const map = new Map<string, Workout[]>()
  for (const w of workouts) {
    const key = monthKey(w.date)
    const group = map.get(key) ?? []
    group.push(w)
    map.set(key, group)
  }
  return [...map.entries()]
}

export default function History() {
  const { workouts, loading, error } = useWorkouts()

  const groups = groupByMonth(workouts)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">History</h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-gray-400">
              {workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'} total
            </p>
          )}
        </div>
        <Link
          to="/log"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Start workout
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && workouts.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
          No workouts yet — hit <strong>Start workout</strong> to log your first session.
        </p>
      )}

      <div className="space-y-8">
        {groups.map(([key, group]) => (
          <section key={key}>
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-500">
                {monthLabel(group[0].date)}
              </h2>
              <span className="text-xs text-gray-300">
                {group.length} {group.length === 1 ? 'session' : 'sessions'}
              </span>
            </div>

            <ul className="space-y-2">
              {group.map(w => (
                <li key={w.id}>
                  <Link
                    to={`/workout/${w.id}`}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                      w.is_rest_day
                        ? 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {w.is_rest_day && <span className="text-base leading-none">😴</span>}
                        <p className="font-medium text-gray-900">
                          {w.is_rest_day ? (w.title ?? 'Rest Day') : (w.title ?? 'Workout')}
                        </p>
                      </div>
                      <p className="text-sm text-gray-400">{formatDay(w.date)}</p>
                    </div>
                    <span className="text-sm text-gray-400">
                      {w.is_rest_day ? '😴' : w.duration_minutes ? `${w.duration_minutes} min` : '›'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
