import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

/** Aparece quando a pessoa entra com e-mail e senha, mas o cadastro dela foi excluído pela associação. */
export function CadastroExcluido() {
  const { recriarCadastro, logout } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  async function recriar() {
    setErro(null)
    setCriando(true)
    try {
      await recriarCadastro()
    } catch {
      setErro('Não consegui criar o cadastro agora. Tente de novo.')
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="chamfer panel w-full max-w-sm p-6 text-center">
        <img src="/logo.png" alt="AACN" className="mx-auto mb-3 h-16 w-16 rounded-full ring-2 ring-accent-hi/60" />
        <h1 className="text-lg font-bold text-ink">Cadastro excluído</h1>
        <p className="mt-2 text-sm text-mute">
          O seu cadastro na AACN foi excluído. Se quiser voltar a ser associado, crie o cadastro de novo: você começa do
          zero, como um novo associado.
        </p>
        {erro && <p className="mt-3 text-sm text-danger">{erro}</p>}
        <button onClick={recriar} disabled={criando} className="btn-primary mt-5 w-full">
          {criando ? 'Criando...' : 'Criar cadastro novamente'}
        </button>
        <button onClick={() => logout()} className="btn-ghost mt-2 w-full">
          Sair
        </button>
      </div>
    </div>
  )
}
