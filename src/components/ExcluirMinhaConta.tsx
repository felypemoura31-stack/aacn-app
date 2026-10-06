import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

/** "Meus dados": o jogador exclui a própria conta (pede a senha e confirma). */
export function ExcluirMinhaConta() {
  const { excluirConta, player } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // o cargo de admin só existe no console do Firebase; o app não exclui admins
  if (!player || player.role === 'admin') return null

  async function excluir() {
    setErro(null)
    setExcluindo(true)
    try {
      await excluirConta(senha)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir a conta. Tente de novo.')
      setExcluindo(false)
    }
  }

  return (
    <div className="panel mt-8 border-danger/40 p-5">
      <h2 className="text-sm font-bold text-ink">Excluir minha conta</h2>
      {!aberto ? (
        <>
          <p className="mt-1 text-xs text-mute">Apaga seu cadastro e seu acesso ao app. Não dá para desfazer.</p>
          <button type="button" className="btn-ghost mt-3" onClick={() => setAberto(true)}>
            Quero excluir minha conta
          </button>
        </>
      ) : (
        <div className="mt-2 space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-xs text-mute">
            <li>Seu cadastro, foto, contato e carteirinha são apagados, e você sai dos times e dos jogos em que ainda não fez check-in.</li>
            <li>Seu saldo de créditos e suas conquistas deixam de existir para você.</li>
            <li>
              Os registros financeiros (pagamentos e extrato) e as presenças em jogos já realizados ficam guardados pela
              associação.
            </li>
            <li>Se você é representante de um time, peça a um administrador para passar a representação antes.</li>
          </ul>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">Digite sua senha para confirmar</span>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-sm border border-line bg-surface2 px-3 py-2 text-ink"
            />
          </label>
          <label className="flex items-start gap-2 text-xs text-mute">
            <input type="checkbox" className="mt-0.5" checked={confirma} onChange={(e) => setConfirma(e.target.checked)} />
            Entendo que isso é definitivo.
          </label>
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={excluindo || !senha || !confirma}
              onClick={excluir}
              className="rounded-sm bg-danger px-4 py-2 text-sm font-semibold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
            >
              {excluindo ? 'Excluindo...' : 'Excluir conta'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setAberto(false)} disabled={excluindo}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
