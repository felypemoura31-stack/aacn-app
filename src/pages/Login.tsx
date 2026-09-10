import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, senha)
      navigate('/')
    } catch {
      setError('E-mail ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-bold text-slate-900">AACN</h1>
        <p className="mb-6 text-sm text-slate-500">
          Associação de Airsoft de Caldas Novas
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          E-mail
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Senha
        </label>
        <input
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-slate-900 underline">
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  )
}
