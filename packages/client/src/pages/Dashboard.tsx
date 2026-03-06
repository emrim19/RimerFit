import { Link } from 'react-router-dom'
import { useWorkouts } from '../hooks/useWorkouts'
import { useDashboardStats } from '../hooks/useDashboardStats'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`
  return Math.round(kg).toLocaleString()
}

export default function Dashboard() {
  const { workouts, loading, error } = useWorkouts(10)
  const { stats } = useDashboardStats()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/log"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Start workout
        </Link>
      </div>

      {/* Summary stat cards */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">This week</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

          {/* Workouts this week */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Workouts</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">
              {stats ? stats.workoutsThisWeek : '—'}
            </p>
            <p className="text-xs text-gray-400">this week</p>
          </div>

          {/* Volume this week */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Volume</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">
              {stats ? (stats.volumeThisWeek > 0 ? formatVolume(stats.volumeThisWeek) : '0') : '—'}
            </p>
            <p className="text-xs text-gray-400">kg lifted</p>
          </div>

          {/* Streak */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Streak</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">
              {stats ? stats.streak : '—'}
            </p>
            <p className="text-xs text-gray-400">day{stats?.streak !== 1 ? 's' : ''}</p>
          </div>

          {/* Body weight */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Weight</p>
            {stats?.latestWeight != null ? (
              <>
                <p className="mt-0.5 text-2xl font-bold text-gray-900">{stats.latestWeight}</p>
                <p className="text-xs text-gray-400">
                  kg
                  {stats.weightChange !== null && (
                    <span className={stats.weightChange > 0 ? ' text-red-400' : ' text-green-500'}>
                      {' '}{stats.weightChange > 0 ? '+' : ''}{stats.weightChange}
                    </span>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="mt-0.5 text-base text-gray-300">—</p>
                <Link to="/metrics" className="text-xs text-blue-500 hover:underline">Log weight</Link>
              </>
            )}
          </div>

        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Recent workouts
        </h2>

        {loading && (
          <p className="text-sm text-gray-400">Loading…</p>
        )}

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {!loading && !error && workouts.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
            No workouts yet — hit <strong>Start workout</strong> to log your first session.
          </p>
        )}

        {!loading && !error && workouts.length > 0 && (
          <ul className="space-y-2">
            {workouts.map(w => (
              <li key={w.id}>
                <Link
                  to={`/workout/${w.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{w.title ?? 'Workout'}</p>
                    <p className="text-sm text-gray-500">{formatDate(w.date)}</p>
                  </div>
                  <span className="text-sm text-gray-400">
                    {w.duration_minutes ? `${w.duration_minutes} min` : '›'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
