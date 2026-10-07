import { CREDITOS_POR_REAL, formatarCreditos } from '../lib/credits'
import { STATUS_COLORS, STATUS_LABELS, formatarData, statusEfetivo } from '../lib/status'
import { useWallet } from '../lib/useWallet'
import { PagamentoPix } from './PagamentoPix'
import type { Player } from '../types'

/** Créditos e mensalidade lado a lado, com o botão de pagar logo abaixo (antes eram três blocos separados). */
export function ResumoConta({ player }: { player: Player }) {
  const wallet = useWallet(player.uid)
  const status = statusEfetivo(player)

  return (
    <div className="no-print panel p-5">
      <div className="grid grid-cols-2 gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-mute/80">Créditos de jogo</p>
          <p className="mt-1 text-3xl font-bold text-gold">{formatarCreditos(wallet?.creditos ?? 0)}</p>
          <p className="mt-1 text-[11px] text-mute">R$ 1 pago = {CREDITOS_POR_REAL} créditos</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-mute/80">Mensalidade</p>
          <p className="mt-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
          </p>
          <p className="mt-2 text-[11px] text-mute">
            {player.vencimento ? `${status === 'pago' ? 'Em dia até' : 'Venceu em'} ${formatarData(player.vencimento)}` : 'Nenhum pagamento ainda'}
          </p>
        </div>
      </div>
      <PagamentoPix player={player} embutido />
    </div>
  )
}
