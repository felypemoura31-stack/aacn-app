import QRCode from 'react-qr-code'
import { useAuth } from '../contexts/AuthContext'
import { STATUS_COLORS, STATUS_LABELS } from '../lib/status'

export function Card() {
  const { currentUser, player } = useAuth()

  if (!currentUser || !player) return null

  const verifyUrl = `${window.location.origin}/verificar/${player.uid}`
  const faltamDados =
    !player.fotoUrl || !player.endereco || !player.dataNascimento

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="no-print mb-6 text-xl font-bold text-slate-900">
        Minha carteirinha
      </h1>

      {faltamDados && (
        <div className="no-print mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Complete sua foto e seus dados em{' '}
          <span className="font-semibold">Meus dados</span> para finalizar sua
          carteirinha.
        </div>
      )}

      <div
        id="print-card"
        className="mx-auto w-full max-w-sm rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
      >
        <div className="mb-3 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Associação de Airsoft de Caldas Novas
          </p>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">
            Carteira do associado
          </p>
        </div>

        <div className="flex gap-4">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded border border-slate-300 bg-slate-100">
            {player.fotoUrl ? (
              <img
                src={player.fotoUrl}
                alt={player.nomeCompleto}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                sem foto
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col justify-between">
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">
                {player.nomeCompleto || '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Time: {player.timeAprovado ? player.timeNome : 'Nenhum'}
              </p>
              <p className="text-xs text-slate-500">
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

        <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-300 pt-3">
          <p className="max-w-[60%] text-[10px] leading-tight text-slate-400">
            Parceiros: escaneie para validar associado e status de pagamento.
          </p>
          <div className="rounded bg-white p-1">
            <QRCode value={verifyUrl} size={72} />
          </div>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="no-print mx-auto mt-6 block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Imprimir carteirinha
      </button>
    </div>
  )
}
