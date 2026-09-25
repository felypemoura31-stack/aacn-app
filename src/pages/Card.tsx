import QRCode from 'react-qr-code'
import { useAuth } from '../contexts/AuthContext'
import { STATUS_COLORS, STATUS_LABELS } from '../lib/status'

export function Card() {
  const { currentUser, player } = useAuth()

  if (!currentUser || !player) return null

  const verifyUrl = `${window.location.origin}/verificar/${player.uid}`
  const faltamDados = !player.endereco || !player.dataNascimento

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="no-print mb-6 text-xl font-bold text-ink">
        Minha carteirinha
      </h1>

      {faltamDados && (
        <div className="no-print mb-4 rounded-sm border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Complete seus dados em{' '}
          <span className="font-semibold">Meus dados</span> para finalizar sua
          carteirinha.
        </div>
      )}

      <div
        id="print-card"
        className="chamfer mx-auto w-full max-w-sm panel p-5"
      >
        <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
          <img src="/logo.png" alt="AACN" className="h-12 w-12 rounded-full ring-1 ring-accent-hi/60" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink">
              Associação de Airsoft de Caldas Novas
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gold">
              Carteira do associado
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded border border-line bg-surface2">
            {player.fotoUrl ? (
              <img
                src={player.fotoUrl}
                alt={player.nomeCompleto}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-mute/70">
                sem foto
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col justify-between">
            <div>
              <p className="text-sm font-bold leading-tight text-ink">
                {player.nomeCompleto || '—'}
              </p>
              <p className="mt-1 text-xs text-mute">
                Time: {player.timeAprovado ? player.timeNome : 'Nenhum'}
              </p>
              <p className="text-xs text-mute">
                Nasc.: {player.dataNascimento || '—'}
              </p>
            </div>
            <span
              className={`mt-2 w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[player.status]}`}
            >
              {STATUS_LABELS[player.status]}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-dashed border-line pt-3">
          <p className="max-w-[60%] text-[10px] leading-tight text-mute/70">
            Parceiros: escaneie para validar associado e status de pagamento.
          </p>
          <div className="rounded-sm bg-[#ffffff] p-1.5">
            <QRCode value={verifyUrl} size={72} />
          </div>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="no-print mx-auto mt-6 block btn-primary"
      >
        Imprimir carteirinha
      </button>
    </div>
  )
}
