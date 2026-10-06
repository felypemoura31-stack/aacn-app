import { useState } from 'react'
import { ROTULOS_RESET, resetarJogador, type OpcoesReset } from '../lib/reset'

const NADA: OpcoesReset = { extrato: false, conquistas: false, jogos: false, mensalidades: false }

/** Só para o admin: apaga dados de teste de um jogador, parte por parte. */
export function ResetJogador({ uid, nome, aoTerminar }: { uid: string; nome: string; aoTerminar: () => void }) {
  const [marcado, setMarcado] = useState<OpcoesReset>(NADA)
  const [executando, setExecutando] = useState(false)
  const [resultado, setResultado] = useState<string[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const escolhidos = ROTULOS_RESET.filter((r) => marcado[r.id])
  const tudo = escolhidos.length === ROTULOS_RESET.length

  async function executar() {
    if (escolhidos.length === 0) return
    const lista = escolhidos.map((r) => `• ${r.titulo}`).join('\n')
    if (!window.confirm(`Apagar para ${nome}:\n\n${lista}\n\nIsso não pode ser desfeito. Continuar?`)) return
    setExecutando(true)
    setErro(null)
    setResultado(null)
    try {
      setResultado(await resetarJogador(uid, marcado))
      setMarcado(NADA)
      aoTerminar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui resetar. Tente de novo.')
    } finally {
      setExecutando(false)
    }
  }

  return (
    <div className="panel mt-6 border-danger/40 p-5">
      <h2 className="text-sm font-bold text-ink">Resetar dados (testes)</h2>
      <p className="mt-1 text-xs text-mute">
        Apaga de verdade os dados marcados deste jogador. O cadastro, a foto e o time não são tocados. Use para limpar testes.
      </p>

      <div className="mt-3 space-y-2">
        {ROTULOS_RESET.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={marcado[r.id]}
              onChange={(e) => setMarcado((m) => ({ ...m, [r.id]: e.target.checked }))}
            />
            <span>
              <span className="font-medium text-ink">{r.titulo}</span>
              <span className="block text-xs text-mute">{r.detalhe}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setMarcado(tudo ? NADA : { extrato: true, conquistas: true, jogos: true, mensalidades: true })}
        >
          {tudo ? 'Desmarcar tudo' : 'Marcar tudo'}
        </button>
        <button
          type="button"
          disabled={executando || escolhidos.length === 0}
          onClick={executar}
          className="rounded-sm bg-danger px-4 py-2 text-sm font-semibold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
        >
          {executando ? 'Resetando...' : 'Resetar selecionados'}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm text-danger">{erro}</p>}
      {resultado && (
        <ul className="mt-3 space-y-1 text-sm text-ok">
          {resultado.map((l) => (
            <li key={l}>✓ {l}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
