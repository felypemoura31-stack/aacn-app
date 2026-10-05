import { CREDITOS_POR_REAL, formatarCreditos } from '../lib/credits'
import { useWallet } from '../lib/useWallet'

export function SaldoCreditos({ uid }: { uid: string }) {
  const wallet = useWallet(uid)
  const saldo = wallet?.creditos ?? 0

  return (
    <div className="no-print panel chamfer mx-auto mt-6 flex w-full max-w-sm items-center justify-between p-5">
      <div>
        <h2 className="text-sm font-bold text-ink">Créditos de jogo</h2>
        <p className="mt-1 text-xs text-mute">
          Cada R$ 1,00 pago na mensalidade vira {CREDITOS_POR_REAL} créditos.
        </p>
      </div>
      <p className="text-3xl font-bold text-gold">{formatarCreditos(saldo)}</p>
    </div>
  )
}
