import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import QRCode from 'react-qr-code'
import { db } from '../firebase'
import { gerarCobranca } from '../lib/payments'
import { gerarPixCopiaECola } from '../lib/pix'
import { STATUS_COLORS, STATUS_LABELS, formatarData, statusEfetivo } from '../lib/status'
import type { Payment, PixConfig, Player } from '../types'

export function PagamentoPix({ player }: { player: Player }) {
  const [cfg, setCfg] = useState<PixConfig | null | undefined>(undefined)
  const [pendente, setPendente] = useState<Payment | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'pix'), (snap) => {
      setCfg(snap.exists() ? (snap.data() as PixConfig) : null)
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'payments'), where('uid', '==', player.uid))
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment)
      setPendente(lista.find((p) => p.status === 'pendente') ?? null)
    })
  }, [player.uid])

  const status = statusEfetivo(player)
  const configurado = cfg && cfg.chave && cfg.valor > 0

  async function handleGerar() {
    if (!cfg) return
    setGerando(true)
    try {
      await gerarCobranca(player, cfg)
    } finally {
      setGerando(false)
    }
  }

  const payload = pendente && configurado ? gerarPixCopiaECola({ ...cfg, valor: pendente.valor }, pendente.txid) : null

  async function copiar() {
    if (!payload) return
    await navigator.clipboard.writeText(payload)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="no-print panel chamfer mx-auto mt-6 w-full max-w-sm p-5">
      <h2 className="mb-3 text-sm font-bold text-ink">Mensalidade</h2>

      <div className="mb-3 flex items-center justify-between text-sm">
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="text-mute">
          {player.vencimento
            ? `${status === 'pago' ? 'Em dia até' : 'Venceu em'} ${formatarData(player.vencimento)}`
            : 'Nenhum pagamento registrado'}
        </span>
      </div>

      {status === 'inativo' && (
        <p className="text-xs text-mute">
          Seu cadastro está inativo. Fale com a diretoria da AACN.
        </p>
      )}

      {status !== 'inativo' && cfg === null && (
        <p className="text-xs text-mute">
          O pagamento por Pix ainda não está disponível. A associação vai configurar a chave em breve.
        </p>
      )}

      {status !== 'inativo' && configurado && !pendente && (
        <button onClick={handleGerar} disabled={gerando} className="btn-primary w-full">
          {gerando
            ? 'Gerando...'
            : `Gerar Pix de R$ ${cfg.valor.toFixed(2).replace('.', ',')}`}
        </button>
      )}

      {payload && pendente && (
        <div className="space-y-3">
          <div className="mx-auto w-fit rounded-sm bg-[#ffffff] p-2">
            <QRCode value={payload} size={168} />
          </div>
          <p className="text-center text-sm text-ink">
            Valor: <b>R$ {pendente.valor.toFixed(2).replace('.', ',')}</b>
          </p>
          <textarea readOnly value={payload} rows={3} className="input font-mono text-[10px]" />
          <button onClick={copiar} className="btn-primary w-full">
            {copiado ? 'Copiado!' : 'Copiar Pix copia e cola'}
          </button>
          <p className="text-xs text-mute">
            Pague no app do seu banco. Assim que a diretoria confirmar o recebimento, seu
            status é atualizado e o próximo vencimento passa a valer 30 dias depois do pagamento.
          </p>
        </div>
      )}
    </div>
  )
}
