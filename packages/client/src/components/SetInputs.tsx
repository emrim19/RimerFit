export type ExerciseType = 'strength' | 'cardio' | 'bodyweight'

export interface SetRow {
  reps: string
  weight_kg: string
  duration_minutes: string
  distance_km: string
  rpe: string
}

export function emptySet(): SetRow {
  return { reps: '', weight_kg: '', duration_minutes: '', distance_km: '', rpe: '' }
}

export const inputCls =
  'min-w-0 flex-1 rounded-lg border border-stone-700 bg-stone-800 px-2 py-1.5 text-sm text-stone-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

export function setTypeLabel(type: ExerciseType) {
  if (type === 'cardio') return 'min · km'
  if (type === 'bodyweight') return 'reps · RPE'
  return 'reps · kg'
}

export function SetInputs({
  type,
  set,
  onChange,
}: {
  type: ExerciseType
  set: SetRow
  onChange: (field: keyof SetRow, value: string) => void
}) {
  if (type === 'strength') {
    return (
      <>
        <input type="number" inputMode="numeric" placeholder="Reps" value={set.reps}
          onChange={e => onChange('reps', e.target.value)} className={inputCls} />
        <input type="number" inputMode="decimal" placeholder="kg" value={set.weight_kg}
          onChange={e => onChange('weight_kg', e.target.value)} className={inputCls} />
      </>
    )
  }
  if (type === 'cardio') {
    return (
      <>
        <input type="number" inputMode="decimal" placeholder="Min" value={set.duration_minutes}
          onChange={e => onChange('duration_minutes', e.target.value)} className={inputCls} />
        <input type="number" inputMode="decimal" placeholder="km" value={set.distance_km}
          onChange={e => onChange('distance_km', e.target.value)} className={inputCls} />
      </>
    )
  }
  return (
    <>
      <input type="number" inputMode="numeric" placeholder="Reps" value={set.reps}
        onChange={e => onChange('reps', e.target.value)} className={inputCls} />
      <input type="number" inputMode="numeric" placeholder="RPE 1–10" min={1} max={10} value={set.rpe}
        onChange={e => onChange('rpe', e.target.value)} className={inputCls} />
    </>
  )
}
