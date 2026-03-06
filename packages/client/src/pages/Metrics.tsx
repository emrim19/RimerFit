import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useBodyMetrics, type NewBodyMetric } from '../hooks/useBodyMetrics'

type MetricKey = 'weight_kg' | 'body_fat_pct' | 'muscle_mass_kg'

const METRIC_CONFIG: Record<MetricKey, { label: string; unit: string; color: string }> = {
  weight_kg:      { label: 'Weight',      unit: 'kg', color: '#3b82f6' },
  body_fat_pct:   { label: 'Body fat',    unit: '%',  color: '#f97316' },
  muscle_mass_kg: { label: 'Muscle mass', unit: 'kg', color: '#22c55e' },
}

interface FormState {
  date: string
  weight_kg: string
  height_cm: string
  body_fat_pct: string
  muscle_mass_kg: string
  notes: string
}

const EMPTY_FORM: FormState = {
  date: new Date().toISOString().slice(0, 10),
  weight_kg: '',
  height_cm: '',
  body_fat_pct: '',
  muscle_mass_kg: '',
  notes: '',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const FORM_FIELDS: { key: keyof Omit<FormState, 'date' | 'notes'>; label: string; placeholder: string }[] = [
  { key: 'weight_kg',      label: 'Weight (kg)',      placeholder: '70.0' },
  { key: 'height_cm',      label: 'Height (cm)',      placeholder: '175' },
  { key: 'body_fat_pct',   label: 'Body fat (%)',     placeholder: '15.0' },
  { key: 'muscle_mass_kg', label: 'Muscle mass (kg)', placeholder: '60.0' },
]

export default function Metrics() {
  const { metrics, loading, error, saveMetric, updateMetric, deleteMetric } = useBodyMetrics()
  const [activeMetric, setActiveMetric] = useState<MetricKey>('weight_kg')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const latest = metrics[metrics.length - 1]

  const chartData = metrics
    .filter(m => m[activeMetric] !== null)
    .map(m => ({ date: formatDate(m.date), value: m[activeMetric] }))

  function field(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function startEdit(m: ReturnType<typeof useBodyMetrics>['metrics'][number]) {
    setForm({
      date:           m.date,
      weight_kg:      m.weight_kg      !== null ? String(m.weight_kg)      : '',
      height_cm:      m.height_cm      !== null ? String(m.height_cm)      : '',
      body_fat_pct:   m.body_fat_pct   !== null ? String(m.body_fat_pct)   : '',
      muscle_mass_kg: m.muscle_mass_kg !== null ? String(m.muscle_mass_kg) : '',
      notes:          m.notes ?? '',
    })
    setEditingId(m.id)
    setShowForm(true)
    setFormError(null)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.weight_kg && !form.height_cm && !form.body_fat_pct && !form.muscle_mass_kg) {
      setFormError('Enter at least one measurement.')
      return
    }
    setSaving(true)
    try {
      const entry: NewBodyMetric = {
        date: form.date,
        weight_kg:      form.weight_kg      ? parseFloat(form.weight_kg)      : null,
        height_cm:      form.height_cm      ? parseFloat(form.height_cm)      : null,
        body_fat_pct:   form.body_fat_pct   ? parseFloat(form.body_fat_pct)   : null,
        muscle_mass_kg: form.muscle_mass_kg ? parseFloat(form.muscle_mass_kg) : null,
        notes: form.notes || null,
      }
      if (editingId) {
        await updateMetric(editingId, entry)
      } else {
        await saveMetric(entry)
      }
      cancelForm()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMetric(id)
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const cfg = METRIC_CONFIG[activeMetric]

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Body Metrics</h1>
        <button
          onClick={() => showForm ? cancelForm() : setShowForm(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Log metrics'}
        </button>
      </div>

      {/* Log form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-5 space-y-4"
        >
          <h2 className="font-semibold text-gray-900">{editingId ? 'Edit entry' : 'New entry'}</h2>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">Date</span>
            <input
              type="date"
              lang="en-GB"
              value={form.date}
              onChange={e => field('date', e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            {FORM_FIELDS.map(({ key, label, placeholder }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">
                  {label} <span className="font-normal text-gray-400">optional</span>
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => field(key, e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">
              Notes <span className="font-normal text-gray-400">optional</span>
            </span>
            <input
              type="text"
              placeholder="e.g. morning, before breakfast"
              value={form.notes}
              onChange={e => field('notes', e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingId ? 'Update entry' : 'Save entry'}
          </button>
        </form>
      )}

      {/* Loading / error */}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Empty state */}
      {!loading && !error && metrics.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
          No entries yet — hit <strong>Log metrics</strong> to track your first measurement.
        </p>
      )}

      {!loading && !error && metrics.length > 0 && (
        <>
          {/* Latest snapshot */}
          {latest && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Latest</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ['Weight',      latest.weight_kg,      'kg'],
                    ['Height',      latest.height_cm,      'cm'],
                    ['Body fat',    latest.body_fat_pct,   '%'],
                    ['Muscle mass', latest.muscle_mass_kg, 'kg'],
                  ] as [string, number | null, string][]
                ).map(([label, val, unit]) => (
                  <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    {val !== null ? (
                      <>
                        <p className="mt-0.5 text-xl font-bold text-gray-900">{val}</p>
                        <p className="text-xs text-gray-400">{unit}</p>
                      </>
                    ) : (
                      <p className="mt-0.5 text-base text-gray-300">—</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Progress chart */}
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Progress</h2>
              <div className="flex gap-2">
                {(Object.entries(METRIC_CONFIG) as [MetricKey, typeof METRIC_CONFIG[MetricKey]][]).map(([key, c]) => (
                  <button
                    key={key}
                    onClick={() => setActiveMetric(key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeMetric === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length < 2 ? (
              <p className="text-sm text-gray-400">Log at least 2 entries to see a trend.</p>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} domain={['auto', 'auto']} />
                    <Tooltip
                      formatter={(v: number | undefined) => v !== undefined ? [`${v} ${cfg.unit}`, cfg.label] : ['-', cfg.label]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={cfg.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* History table */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">History</h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-right font-medium">Weight</th>
                    <th className="px-4 py-2 text-right font-medium">Height</th>
                    <th className="px-4 py-2 text-right font-medium">Body fat</th>
                    <th className="px-4 py-2 text-right font-medium">Muscle</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {[...metrics].reverse().map(m => (
                    <tr key={m.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2 text-gray-700">{formatDate(m.date)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {m.weight_kg      !== null ? `${m.weight_kg} kg`      : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {m.height_cm      !== null ? `${m.height_cm} cm`      : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {m.body_fat_pct   !== null ? `${m.body_fat_pct}%`     : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {m.muscle_mass_kg !== null ? `${m.muscle_mass_kg} kg` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {deletingId === m.id ? (
                          <span className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="text-xs font-medium text-red-500 hover:text-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => startEdit(m)}
                              className="text-gray-400 hover:text-gray-700"
                              title="Edit"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletingId(m.id)}
                              className="text-gray-400 hover:text-red-500"
                              title="Delete"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
