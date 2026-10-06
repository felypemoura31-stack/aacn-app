import { useState } from 'react'
import { excluirJogador } from '../lib/conta'

/** Só para o admin: exclui um jogador de vez (digitando o nome para confirmar). */
export function ExcluirJogador({ uid, nome, aoExcluir }: { uid: string; nome: string; aoExcluir: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [digitado, setDigitado] = useState('')
  const [manter, setManter] = useState(true)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const confere = digitado.trim().toLowerCase() === nome.trim().toLowerCase()

  async function excluir() {
    setErro(null)
    setExcluindo(true)
    try {
      await excluirJogador(uid, { manterFinanceiro: manter })
      aoExcluir()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir. Tente de novo.')
      setExcluindo(false)
    }
  }

  return (
    <div className="panel mt-6 border-danger/40 p-5">
      <h2 className="text-sm font-bold text-ink">Excluir jogador</h2>
      {!aberto ? (
        <>
          <p className="mt-1 text-xs text-mute">Apaga o cadastro e os dados deste jogador. Não dá para desfazer.</p>
          <button type="button" className="btn-ghost mt-3" onClick={() => setAberto(true)}>
            Excluir {nome}
          </button>
        </>
      ) : (
        <div className="mt-2 space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-xs text-mute">
            <li>
              Apaga cadastro, cartão público, contato, carteira de créditos, conquistas, contadores, inscrições/presenças
              (as vagas dos jogos são devolvidas) e pedidos de time.
            </li>
            <li>Se for representante de um time, o time fica sem representante.</li>
            <li>
              O e-mail e a senha dele continuam no Firebase Authentication (o app não consegue apagar). Se ele entrar de
              novo, vê "Cadastro excluído" e pode criar outro; para remover de vez, apague o usuário no console do Firebase.
            </li>
          </ul>
          <label className="flex items-start gap-2 text-xs text-mute">
            <input type="checkbox" className="mt-0.5" checked={manter} onChange={(e) => setManter(e.target.checked)} />
            Manter os registros financeiros (pagamentos Pix e extrato de créditos) para a contabilidade
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">
              Para confirmar, digite o nome: <b>{nome}</b>
            </span>
            <input
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              className="w-full rounded-sm border border-line bg-surface2 px-3 py-2 text-ink"
            />
          </label>
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={excluindo || !confere}
              onClick={excluir}
              className="rounded-sm bg-danger px-4 py-2 text-sm font-semibold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
            >
              {excluindo ? 'Excluindo...' : 'Excluir jogador'}
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
