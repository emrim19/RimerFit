import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkouts } from '../hooks/useWorkouts'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { usePersonalRecords } from '../hooks/usePersonalRecords'
import { useMuscleGroupVolume } from '../hooks/useMuscleGroupVolume'
import type { MuscleVolumePeriod, MuscleGroupData } from '../hooks/useMuscleGroupVolume'
import { useMuscleGroupColors } from '../hooks/useMuscleGroupColors'

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

type MuscleMetric = 'volume' | 'sets' | 'reps' | 'sessions'

const MUSCLE_METRICS: { metric: MuscleMetric; label: string }[] = [
  { metric: 'volume',   label: 'Volume'   },
  { metric: 'sets',     label: 'Sets'     },
  { metric: 'reps',     label: 'Reps'     },
  { metric: 'sessions', label: 'Sessions' },
]

function metricValue(g: MuscleGroupData, metric: MuscleMetric): number {
  return metric === 'volume' ? g.volume : metric === 'sets' ? g.sets : metric === 'reps' ? g.reps : g.sessions
}

function formatMetricValue(val: number, metric: MuscleMetric): string {
  if (metric === 'volume') return `${formatVolume(val)} kg`
  if (metric === 'sets')   return `${val} set${val !== 1 ? 's' : ''}`
  if (metric === 'reps')   return `${val.toLocaleString()} rep${val !== 1 ? 's' : ''}`
  return `${val} session${val !== 1 ? 's' : ''}`
}

export default function Dashboard() {
  const { workouts, loading, error } = useWorkouts(10)
  const { stats } = useDashboardStats()
  const { records: prs } = usePersonalRecords()
  const [volumePeriod, setVolumePeriod] = useState<MuscleVolumePeriod>('week')
  const [muscleMetric, setMuscleMetric] = useState<MuscleMetric>('volume')
  const { data: muscleVolume, loading: muscleLoading } = useMuscleGroupVolume(volumePeriod)
  const { getColor } = useMuscleGroupColors()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <Link
          to="/log"
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-600"
        >
          + Start workout
        </Link>
      </div>

      {/* Summary stat cards */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">This week</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-400">Workouts</p>
            <p className="mt-0.5 text-2xl font-bold text-slate-100">
              {stats ? stats.workoutsThisWeek : '—'}
            </p>
            <p className="text-xs text-slate-500">this week</p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-400">Volume</p>
            <p className="mt-0.5 text-2xl font-bold text-slate-100">
              {stats ? (stats.volumeThisWeek > 0 ? formatVolume(stats.volumeThisWeek) : '0') : '—'}
            </p>
            <p className="text-xs text-slate-500">kg lifted</p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-400">Streak</p>
            <p className="mt-0.5 text-2xl font-bold text-slate-100">
              {stats ? stats.streak : '—'}
            </p>
            <p className="text-xs text-slate-500">day{stats?.streak !== 1 ? 's' : ''}</p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-400">Weight</p>
            {stats?.latestWeight != null ? (
              <>
                <p className="mt-0.5 text-2xl font-bold text-slate-100">{stats.latestWeight}</p>
                <p className="text-xs text-slate-500">
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
                <p className="mt-0.5 text-base text-slate-600">—</p>
                <Link to="/metrics" className="text-xs text-blue-500 hover:underline">Log weight</Link>
              </>
            )}
          </div>

        </div>
      </section>

      {/* Personal records this week */}
      {prs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            PRs this week
          </h2>
          <div className="flex flex-wrap gap-2">
            {prs.map(pr => (
              <div
                key={pr.exerciseName}
                className="flex items-center gap-2 rounded-xl border border-blue-700 bg-blue-950 px-4 py-2.5"
              >
                <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-xs font-bold text-slate-950">PR</span>
                <div>
                  <p className="text-sm font-medium text-slate-100">{pr.exerciseName}</p>
                  <p className="text-xs text-slate-400">
                    {pr.weightKg} kg{pr.reps ? ` × ${pr.reps} reps` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Muscle group breakdown */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            By muscle
          </h2>
          <div className="flex rounded-lg border border-slate-700 p-0.5 text-xs font-medium">
            {(['week', '4weeks'] as MuscleVolumePeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setVolumePeriod(p)}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  volumePeriod === p ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {p === 'week' ? 'This week' : '4 weeks'}
              </button>
            ))}
          </div>
        </div>

        {/* Metric toggle */}
        <div className="mb-3 flex rounded-lg border border-slate-700 p-0.5 text-xs font-medium">
          {MUSCLE_METRICS.map(({ metric, label }) => (
            <button
              key={metric}
              onClick={() => setMuscleMetric(metric)}
              className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${
                muscleMetric === metric ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          {muscleLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : muscleVolume.length === 0 ? (
            <p className="text-sm text-slate-500">No data for this period.</p>
          ) : (
            <>
              {(() => {
                const sorted = [...muscleVolume].sort((a, b) => metricValue(b, muscleMetric) - metricValue(a, muscleMetric))
                const total = sorted.reduce((s, g) => s + metricValue(g, muscleMetric), 0)
                return (
                  <>
                    {/* Segmented bar */}
                    <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full">
                      {sorted.map(g => (
                        <div
                          key={g.group}
                          title={`${g.group}: ${formatMetricValue(metricValue(g, muscleMetric), muscleMetric)}`}
                          style={{ width: `${(metricValue(g, muscleMetric) / total) * 100}%`, backgroundColor: getColor(g.group) }}
                        />
                      ))}
                    </div>

                    {/* Per-group rows */}
                    <ul className="space-y-2.5">
                      {sorted.map(g => {
                        const val = metricValue(g, muscleMetric)
                        const pct = Math.round((val / total) * 100)
                        return (
                          <li key={g.group} className="flex items-center gap-3">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: getColor(g.group) }}
                            />
                            <span className="w-20 shrink-0 text-sm capitalize text-slate-300">{g.group}</span>
                            <div className="flex-1 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: getColor(g.group) }}
                              />
                            </div>
                            <span className="w-20 shrink-0 text-right text-xs text-slate-500">
                              {formatMetricValue(val, muscleMetric)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )
              })()}
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Recent workouts
        </h2>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && workouts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-700 py-12 text-center text-sm text-slate-500">
            No workouts yet — hit <strong>Start workout</strong> to log your first session.
          </p>
        )}

        {!loading && !error && workouts.length > 0 && (
          <ul className="space-y-2">
            {workouts.map(w => (
              <li key={w.id}>
                <Link
                  to={`/workout/${w.id}`}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                    w.is_rest_day
                      ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                      : 'border-slate-700 bg-slate-900 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {w.color && !w.is_rest_day && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
                      )}
                      {w.is_rest_day && <span className="text-base leading-none">😴</span>}
                      <p className="font-medium text-slate-100">
                        {w.is_rest_day ? (w.title ?? 'Rest Day') : (w.title ?? 'Workout')}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">{formatDate(w.date)}</p>
                  </div>
                  <span className="text-sm text-slate-500">
                    {w.is_rest_day ? '😴' : w.duration_minutes ? `${w.duration_minutes} min` : '›'}
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
