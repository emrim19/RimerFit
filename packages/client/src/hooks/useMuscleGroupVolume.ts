import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type MuscleVolumePeriod = 'week' | '4weeks'

export interface MuscleGroupData {
  group: string
  volume: number        // sum of reps × weight_kg (strength only)
  sets: number          // total sets logged
  reps: number          // total reps logged
  sessions: number      // distinct workouts that hit this muscle
  distance_km: number   // cardio only: total distance
  avg_speed_kmh: number // cardio only: average speed
}

// Keep old name as alias so any future consumers don't break
export type MuscleGroupVolume = MuscleGroupData

function periodStart(period: MuscleVolumePeriod): string {
  const d = new Date()
  if (period === 'week') {
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
  } else {
    d.setDate(d.getDate() - 27)
  }
  return d.toISOString().slice(0, 10)
}

export function useMuscleGroupVolume(period: MuscleVolumePeriod) {
  const [data, setData] = useState<MuscleGroupData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const start = periodStart(period)

      const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .gte('date', start)
        .eq('is_rest_day', false)

      const ids = (workouts ?? []).map(w => w.id)
      if (ids.length === 0) { setData([]); setLoading(false); return }

      const { data: sets } = await supabase
        .from('workout_sets')
        .select('workout_id, reps, weight_kg, distance_meters, duration_seconds, exercises(muscle_group, type)')
        .in('workout_id', ids)

      type Entry = { volume: number; sets: number; reps: number; workoutIds: Set<string>; distance_m: number; duration_s: number }
      const map = new Map<string, Entry>()

      for (const s of sets ?? []) {
        const ex = (Array.isArray(s.exercises) ? s.exercises[0] : s.exercises) as { muscle_group: string | null; type: string } | null
        if (!ex) continue
        const group = ex.muscle_group ?? ex.type
        if (!map.has(group)) map.set(group, { volume: 0, sets: 0, reps: 0, workoutIds: new Set(), distance_m: 0, duration_s: 0 })
        const entry = map.get(group)!
        entry.sets++
        if (s.reps) entry.reps += s.reps
        if (s.reps && s.weight_kg) entry.volume += s.reps * s.weight_kg
        if (s.workout_id) entry.workoutIds.add(s.workout_id)
        if (ex.type === 'cardio') {
          if (s.distance_meters) entry.distance_m += s.distance_meters
          if (s.duration_seconds) entry.duration_s += s.duration_seconds
        }
      }

      const result: MuscleGroupData[] = [...map.entries()]
        .map(([group, e]) => {
          const distance_km = e.distance_m / 1000
          const avg_speed_kmh = e.duration_s > 0 ? distance_km / (e.duration_s / 3600) : 0
          return { group, volume: e.volume, sets: e.sets, reps: e.reps, sessions: e.workoutIds.size, distance_km, avg_speed_kmh }
        })
        .sort((a, b) => b.volume - a.volume)

      setData(result)
      setLoading(false)
    }

    load()
  }, [period])

  return { data, loading }
}
