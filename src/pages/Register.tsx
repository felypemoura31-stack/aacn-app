import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PasswordInput } from '../components/PasswordInput'
import { cpfValido, formatarCpf } from '../lib/cadastro'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [aceita, setAceita] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!cpfValido(cpf)) {
      setError('Informe um CPF válido.')
      return
    }
    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem.')
      return
    }
    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (!aceita) {
      setError('Para criar a conta, aceite o termo de responsabilidade e a política de privacidade.')
      return
    }

    setLoading(true)
    try {
      await register({ nomeCompleto, cpf, email, senha, aceitaTermos: aceita })
      navigate('/perfil')
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.')
      } else if (code === 'cpf-em-uso') {
        setError('Este CPF já está cadastrado em outra conta. Se for seu, entre com a conta que você já tem ou use "Esqueci minha senha".')
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
          CPF
        </label>
        <input
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
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
        <PasswordInput value={senha} onChange={setSenha} autoComplete="new-password" className="mb-4" />

        <label className="mb-1 block text-sm font-medium text-ink">
          Confirmar senha
        </label>
        <PasswordInput value={confirmarSenha} onChange={setConfirmarSenha} autoComplete="new-password" className="mb-4" />

        <label className="mb-4 flex items-start gap-2 text-xs text-mute">
          <input type="checkbox" checked={aceita} onChange={(e) => setAceita(e.target.checked)} className="mt-0.5" />
          <span>
            Li e aceito o{' '}
            <Link to="/termos" target="_blank" className="text-ink underline">
              termo de responsabilidade e a política de privacidade
            </Link>{' '}
            da AACN.
          </span>
        </label>

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
