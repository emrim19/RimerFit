import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface DashboardStats {
  workoutsThisWeek: number
  volumeThisWeek: number        // kg lifted (reps × weight_kg)
  streak: number                // consecutive days with a workout
  latestWeight: number | null
  weightChange: number | null   // vs. previous entry
}

/** Returns the ISO date string (YYYY-MM-DD) for the most recent Monday. */
function getStartOfWeek(): string {
  const d = new Date()
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Count consecutive days ending today (or yesterday) that have a workout. */
function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0

  const dateSet = new Set(dates)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayStr = today.toISOString().slice(0, 10)
  const cursor = new Date(today)

  // If nothing logged today, start counting from yesterday
  if (!dateSet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (dateSet.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const startOfWeek = getStartOfWeek()

      // Run independent queries in parallel
      const [weekWorkoutsRes, allDatesRes, bodyWeightRes] = await Promise.all([
        supabase.from('workouts').select('id').gte('date', startOfWeek),
        supabase.from('workouts').select('date'),
        supabase
          .from('body_metrics')
          .select('weight_kg')
          .not('weight_kg', 'is', null)
          .order('date', { ascending: false })
          .limit(2),
      ])

      const weekWorkoutIds = (weekWorkoutsRes.data ?? []).map(w => w.id)

      // Volume requires workout IDs from the previous query
      let volumeThisWeek = 0
      if (weekWorkoutIds.length > 0) {
        const { data: sets } = await supabase
          .from('workout_sets')
          .select('reps, weight_kg')
          .in('workout_id', weekWorkoutIds)

        volumeThisWeek = (sets ?? []).reduce((sum, s) => {
          if (s.reps != null && s.weight_kg != null) return sum + s.reps * s.weight_kg
          return sum
        }, 0)
      }

      const allDates = (allDatesRes.data ?? []).map(w => w.date as string)
      const streak = computeStreak(allDates)

      const weights = bodyWeightRes.data ?? []
      const latestWeight = weights[0]?.weight_kg ?? null
      const prevWeight = weights[1]?.weight_kg ?? null
      const weightChange =
        latestWeight !== null && prevWeight !== null
          ? Math.round((latestWeight - prevWeight) * 10) / 10
          : null

      setStats({ workoutsThisWeek: weekWorkoutIds.length, volumeThisWeek, streak, latestWeight, weightChange })
      setLoading(false)
    }

    load()
  }, [])

  return { stats, loading }
}
