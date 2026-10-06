import { STATUS_COLORS, STATUS_LABELS, formatarData, isEmDia, statusEfetivo } from '../lib/status'
import type { PlayerStatus } from '../types'

export interface CartaoPublico {
  nomeCompleto: string
  fotoUrl: string | null
  timeNome: string | null
  status: PlayerStatus
  vencimento: number | null
}

/** Resultado da verificação de uma carteirinha (usado pelo QR aberto no celular e pelo validador do parceiro). */
export function CartaoVerificado({ card }: { card: CartaoPublico }) {
  const status = statusEfetivo(card)
  const emDia = isEmDia(status)

  return (
    <>
      <div className="mx-auto mb-3 h-28 w-24 overflow-hidden rounded border border-line bg-surface2">
        {card.fotoUrl && <img src={card.fotoUrl} alt={card.nomeCompleto} className="h-full w-full object-cover" />}
      </div>
      <p className="text-lg font-bold text-ink">{card.nomeCompleto}</p>
      <p className="mb-3 text-sm text-mute">Time: {card.timeNome ?? 'Nenhum'}</p>
      <span className={`inline-block rounded-full border px-4 py-1.5 text-base font-bold ${STATUS_COLORS[status]}`}>
        {STATUS_LABELS[status]}
      </span>
      <p className="mt-4 text-sm text-mute">
        {emDia ? 'Associado em dia: tem direito aos descontos de parceiros.' : 'Associado não está em dia com a associação.'}
      </p>
      <p className="mt-1 text-xs text-mute/70">Vencimento: {formatarData(card.vencimento)}</p>
    </>
  )
}
