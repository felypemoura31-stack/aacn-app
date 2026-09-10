import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem.')
      return
    }
    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      await register({ nomeCompleto, email, senha })
      navigate('/perfil')
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.')
      } else {
        setError('Não foi possível criar sua conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-bold text-slate-900">Criar conta</h1>
        <p className="mb-6 text-sm text-slate-500">
          Depois de criar a conta, complete seus dados de associado.
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Nome completo
        </label>
        <input
          required
          value={nomeCompleto}
          onChange={(e) => setNomeCompleto(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

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

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Confirmar senha
        </label>
        <input
          type="password"
          required
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-slate-900 underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  )
}
