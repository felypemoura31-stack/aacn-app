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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="chamfer w-full max-w-sm panel p-6"
      >
        <img
          src="/logo.png"
          alt="AACN"
          className="mx-auto mb-4 h-20 w-20 rounded-full ring-2 ring-accent-hi/60"
        />
        <h1 className="mb-1 text-center text-xl font-bold text-ink">Criar conta</h1>
        <p className="mb-6 text-center text-sm text-mute">
          Depois de criar a conta, complete seus dados de associado.
        </p>

        <label className="mb-1 block text-sm font-medium text-ink">
          Nome completo
        </label>
        <input
          required
          value={nomeCompleto}
          onChange={(e) => setNomeCompleto(e.target.value)}
          className="input mb-4"
        />

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

        <label className="mb-1 block text-sm font-medium text-ink">
          Confirmar senha
        </label>
        <input
          type="password"
          required
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          className="input mb-4"
        />

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>

        <p className="mt-4 text-center text-sm text-mute">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-ink underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  )
}
