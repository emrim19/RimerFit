import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Exercise {
  id: string
  name: string
  muscle_group: string | null
  type: 'strength' | 'cardio' | 'bodyweight'
  user_id: string | null
}

export interface ExerciseData {
  name: string
  type: Exercise['type']
  muscle_group: string | null
}

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, type, user_id')
      .order('name')
    setExercises(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function editExercise(id: string, data: ExerciseData) {
    await supabase.from('exercises').update(data).eq('id', id)
    await fetch()
  }

  async function deleteExercise(id: string) {
    await supabase.from('exercises').delete().eq('id', id)
    await fetch()
  }

  return { exercises, loading, refetch: fetch, editExercise, deleteExercise }
}
