import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Workout {
  id: string
  date: string
  title: string | null
  duration_minutes: number | null
  is_rest_day: boolean
}

export function useWorkouts(limit?: number) {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let query = supabase
      .from('workouts')
      .select('id, date, title, duration_minutes, is_rest_day')
      .order('date', { ascending: false })

    if (limit) query = query.limit(limit)

    query.then(({ data, error }) => {
      if (error) setError(error.message)
      else setWorkouts(data ?? [])
      setLoading(false)
    })
  }, [limit])

  return { workouts, loading, error }
}
