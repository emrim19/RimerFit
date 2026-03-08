import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/" replace />

  if (confirmationSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950">
        <div className="w-full max-w-sm rounded-2xl bg-stone-900 p-8 text-center shadow-lg">
          <div className="mb-4 text-4xl">📬</div>
          <h1 className="mb-2 text-xl font-bold text-stone-100">Check your email</h1>
          <p className="text-sm text-stone-300">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account, then come back and sign in.
          </p>
          <button
            type="button"
            onClick={() => { setConfirmationSent(false); setMode('signin') }}
            className="mt-6 text-sm font-medium text-amber-500 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        navigate('/')
      } else {
        const { needsConfirmation } = await signUp(email, password)
        if (needsConfirmation) {
          setConfirmationSent(true)
        } else {
          navigate('/')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMode() {
    setMode(m => (m === 'signin' ? 'signup' : 'signin'))
    setError(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950">
      <div className="w-full max-w-sm rounded-2xl bg-stone-900 p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-stone-100">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-200">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-200">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-600 disabled:opacity-50"
          >
            {submitting
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-400">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-medium text-amber-500 hover:underline"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
