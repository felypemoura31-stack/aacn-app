import { DIA_MS, formatarData, statusEfetivo } from '../lib/status'
import type { Player } from '../types'

/** Lembrete no topo da carteirinha: mensalidade vencida ou vencendo em até 7 dias. */
export function AvisoMensalidade({ player }: { player: Player }) {
  const status = statusEfetivo(player)
  if (status === 'inativo') return null

  const dias = player.vencimento != null ? Math.ceil((player.vencimento - Date.now()) / DIA_MS) : null
  let texto: string | null = null
  let vencida = false
  if (status === 'inadimplente') {
    vencida = true
    texto = player.vencimento
      ? `Sua mensalidade venceu em ${formatarData(player.vencimento)}.`
      : 'Sua primeira mensalidade ainda não foi paga.'
  } else if (dias !== null && dias <= 7) {
    texto = dias <= 1 ? 'Sua mensalidade vence hoje ou amanhã.' : `Sua mensalidade vence em ${dias} dias (${formatarData(player.vencimento)}).`
  }
  if (!texto) return null

  return (
    <div
      className={`no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border px-4 py-3 text-sm ${
        vencida ? 'border-danger/40 bg-danger/10 text-danger' : 'border-warn/40 bg-warn/10 text-warn'
      }`}
    >
      <span>{texto}</span>
      <button
        onClick={() => document.getElementById('pagamento')?.scrollIntoView({ behavior: 'smooth' })}
        className="btn-primary"
      >
        Pagar agora
      </button>
    </div>
  )
}
