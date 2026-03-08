import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface MuscleGroup {
  id: string
  name: string
  user_id: string | null // null = built-in default
}

export function useMuscleGroups() {
  const [groups, setGroups] = useState<MuscleGroup[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('muscle_groups')
      .select('id, name, user_id')
      .order('created_at', { ascending: true })
    setGroups((data ?? []) as MuscleGroup[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addGroup(name: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('muscle_groups').insert({ name: name.trim().toLowerCase(), user_id: user.id })
    await load()
  }

  async function renameGroup(id: string, name: string) {
    await supabase.from('muscle_groups').update({ name: name.trim().toLowerCase() }).eq('id', id)
    await load()
  }

  async function deleteGroup(id: string) {
    await supabase.from('muscle_groups').delete().eq('id', id)
    await load()
  }

  return { groups, loading, addGroup, renameGroup, deleteGroup }
}
