import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ErrorMessage } from '../components/ErrorMessage'

export function Login() {
  const { session, login, signup } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    return <Navigate to="/calendar" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const result = mode === 'login' ? await login(username, password) : await signup(username, password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (mode === 'signup') {
      setInfo('Account created. You can log in now.')
      setMode('login')
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Prepify</h1>
          <p className="mt-1 text-sm text-ink-500">Study progress tracker</p>
        </div>

        <div className="rounded border border-line bg-white p-6">
          <h2 className="mb-4 text-base font-medium text-ink-900">
            {mode === 'login' ? 'Log in' : 'Create account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-ink-700">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                required
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-ink-700">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                  required
                />
              </div>
            )}

            <ErrorMessage message={error} />
            {info && <p className="text-sm text-green-700">{info}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
            >
              {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-ink-500">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            className="font-medium text-accent-600 hover:underline"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
              setInfo(null)
            }}
          >
            {mode === 'login' ? 'Create one' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
