import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ExerciseType } from '../components/SetInputs'

export interface TemplateExercise {
  exercise_id: string
  name: string
  type: ExerciseType
  order_index: number
  default_sets: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  color: string | null
  exercises: TemplateExercise[]
}

export function useTemplates() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name, color, workout_template_exercises(exercise_id, order_index, default_sets, exercises(id, name, type))')
      .order('created_at', { ascending: false })

    const parsed: WorkoutTemplate[] = (data ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      color: t.color ?? null,
      exercises: (t.workout_template_exercises ?? [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((te: any) => {
          const ex = Array.isArray(te.exercises) ? te.exercises[0] : te.exercises
          return {
            exercise_id: ex.id,
            name: ex.name,
            type: ex.type as ExerciseType,
            order_index: te.order_index,
            default_sets: te.default_sets,
          }
        }),
    }))

    setTemplates(parsed)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { templates, loading, refetch: fetch }
}
