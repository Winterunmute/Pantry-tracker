import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { login, register } from '../api/auth'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: isRegister ? register : login,
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      navigate('/')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    mutation.mutate({ username: username.trim(), password })
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / title */}
        <div className="text-center">
          <p className="text-5xl mb-3">🥫</p>
          <h1 className="text-2xl font-bold text-gray-900">Pantry Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isRegister ? 'Create a new account' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[48px]"
              placeholder="your-username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[48px]"
              placeholder="••••••••"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              {isRegister ? 'Failed to create account.' : 'Invalid username or password.'}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !username.trim() || !password}
            className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:bg-gray-300 text-white font-semibold rounded-xl py-4 transition-colors min-h-[56px]"
          >
            {mutation.isPending ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); mutation.reset() }}
            className="w-full text-sm text-gray-500 hover:text-brand-600 transition-colors py-2"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </form>
      </div>
    </div>
  )
}
