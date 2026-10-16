import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PhotoUploader } from '../components/PhotoUploader'

/** Aparece quando a pessoa entra com e-mail e senha, mas o cadastro dela foi excluído pela associação. */
export function CadastroExcluido() {
  const { recriarCadastro, logout } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [foto, setFoto] = useState<string | null>(null)

  async function recriar() {
    setErro(null)
    if (!foto) return setErro('Envie a sua foto 3x4 para criar o cadastro.')
    setCriando(true)
    try {
      await recriarCadastro(foto)
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
        <div className={`mt-4 rounded-sm border p-3 text-left ${foto ? 'border-line' : 'border-warn/50'}`}>
          <p className="mb-2 text-sm font-medium text-ink">Foto 3x4 (obrigatória)</p>
          <PhotoUploader currentUrl={foto} onChange={async (d) => setFoto(d)} mensagemOk="Foto escolhida." />
        </div>
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
