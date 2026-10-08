import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PasswordInput } from '../components/PasswordInput'
import { cpfValido, formatarCpf } from '../lib/cadastro'

export function Register() {
  const { register, resetPassword } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [aceita, setAceita] = useState(false)
  const [emailEmUso, setEmailEmUso] = useState(false)
  const [redefinicao, setRedefinicao] = useState<'enviando' | 'enviada' | 'erro' | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailEmUso(false)
    setRedefinicao(null)

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
      navigate('/perfil', { state })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setEmailEmUso(true)
        setError('Este e-mail já tem uma conta.')
      } else if (code === 'cpf-em-uso') {
        setError('Este CPF já está cadastrado em outra conta. Se for seu, entre com a conta que você já tem ou use "Esqueci minha senha".')
      } else {
        setError('Não foi possível criar sua conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  /** E-mail que já tem acesso (cadastro excluído ou senha esquecida): manda o link para criar uma nova senha, sem sair da tela. */
  async function enviarRedefinicao() {
    setRedefinicao('enviando')
    try {
      await resetPassword(email.trim())
      setRedefinicao('enviada')
    } catch {
      setRedefinicao('erro')
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

        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        {emailEmUso && (
          <div className="mb-4 rounded-sm border border-line bg-surface2 p-3 text-xs text-mute">
            <p>
              Esse e-mail já tem um acesso ao app. Se você já é associado,{' '}
              <Link to="/login" className="text-ink underline">
                entre
              </Link>
              .
            </p>
            <p className="mt-2">
              Se o seu cadastro foi <b className="text-ink">excluído</b> e você quer voltar, ou se esqueceu a senha, receba um e-mail para criar uma nova senha.
              Depois é só entrar: o app refaz o seu cadastro.
            </p>
            {redefinicao === 'enviada' ? (
              <p className="mt-2 text-ok">
                Enviamos o e-mail para <b>{email.trim()}</b>. Abra o link, escolha a nova senha e entre. Se não chegar, olhe o spam.
              </p>
            ) : (
              <button type="button" onClick={enviarRedefinicao} disabled={redefinicao === 'enviando'} className="btn-ghost mt-2 w-full">
                {redefinicao === 'enviando' ? 'Enviando...' : 'Enviar e-mail para criar nova senha'}
              </button>
            )}
            {redefinicao === 'erro' && <p className="mt-2 text-danger">Não consegui enviar o e-mail agora. Tente de novo em instantes.</p>}
            <p className="mt-2">Se ainda lembra a senha antiga, é só repeti-la no campo de senha e criar a conta de novo.</p>
          </div>
        )}

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
