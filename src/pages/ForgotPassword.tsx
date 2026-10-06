import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await resetPassword(email.trim())
      setEnviado(true)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/invalid-email') setErro('Informe um e-mail válido.')
      else if (code === 'auth/too-many-requests') setErro('Muitas tentativas. Aguarde alguns minutos e tente de novo.')
      else setErro('Não foi possível enviar agora. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="chamfer panel w-full max-w-sm p-6">
        <img src="/logo.png" alt="AACN" className="mx-auto mb-4 h-20 w-20 rounded-full ring-2 ring-accent-hi/60" />
        <h1 className="mb-1 text-center text-xl font-bold text-ink">Recuperar senha</h1>
        <p className="mb-6 text-center text-sm text-mute">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>

        {enviado ? (
          <p className="rounded-sm border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
            Se esse e-mail estiver cadastrado, você vai receber o link em instantes. Confira também a caixa de spam.
          </p>
        ) : (
          <>
            <label className="mb-1 block text-sm font-medium text-ink">E-mail</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input mb-4" />
            {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}
            <button type="submit" disabled={enviando} className="btn-primary w-full">
              {enviando ? 'Enviando...' : 'Enviar link'}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-sm text-mute">
          <Link to="/login" className="font-medium text-ink underline">
            Voltar para o login
          </Link>
        </p>
      </form>
    </div>
  )
}
