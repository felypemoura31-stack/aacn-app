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
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="chamfer w-full max-w-sm panel p-6"
      >
        <img
          src="/logo.png"
          alt="AACN"
          className="mx-auto mb-4 h-28 w-28 rounded-full ring-2 ring-accent-hi/60"
        />
        <h1 className="mb-1 text-center text-xl font-bold text-ink">AACN</h1>
        <p className="mb-6 text-center text-xs uppercase tracking-widest text-mute">
          Associação de Airsoft de Caldas Novas
        </p>

        <label className="mb-1 block text-sm font-medium text-ink">
          E-mail
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mb-4"
        />

        <label className="mb-1 block text-sm font-medium text-ink">
          Senha
        </label>
        <input
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="input mb-4"
        />

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="mt-4 text-center text-sm text-mute">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-ink underline">
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  )
}
