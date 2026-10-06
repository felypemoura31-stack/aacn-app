import { useAuth } from '../contexts/AuthContext'
import { CarteirinhaImpressao } from '../components/CarteirinhaImpressao'
import { PagamentoPix } from '../components/PagamentoPix'
import { SaldoCreditos } from '../components/SaldoCreditos'
import { useTeam } from '../lib/useTeam'
import { STATUS_COLORS, STATUS_LABELS, formatarData, statusEfetivo } from '../lib/status'

export function Card() {
  const { currentUser, player } = useAuth()
  const time = useTeam(player?.timeAprovado ? player.timeId : null)

  if (!currentUser || !player) return null

  const verifyUrl = `${window.location.origin}/verificar/${player.uid}`
  const status = statusEfetivo(player)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="no-print mb-6 text-xl font-bold text-ink">Minha carteirinha</h1>

      <CarteirinhaImpressao
        player={player}
        verifyUrl={verifyUrl}
        timeNome={time?.nome ?? player.timeNome}
        timeLogoUrl={time?.logoUrl ?? null}
      />

      <div className="no-print mx-auto mt-5 flex w-full max-w-sm items-center justify-between text-sm">
        <span className="text-mute">Situação agora</span>
        <span className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-mute">vence {formatarData(player.vencimento)}</span>
        </span>
      </div>

      <button onClick={() => window.print()} className="no-print mx-auto mt-6 block btn-primary">
        Imprimir carteirinha
      </button>
      <p className="no-print mx-auto mt-2 max-w-sm text-center text-xs text-mute/80">
        A carteirinha não traz a situação da mensalidade, porque ela muda. Quem lê o QR vê a situação atual.
      </p>

      <SaldoCreditos uid={player.uid} />
      <PagamentoPix player={player} />
    </div>
  )
}
