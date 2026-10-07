import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { paraMillis } from '../lib/status'
import type { Payment } from '../types'

/** Tesouraria: abre o comprovante enviado pelo jogador, ao lado dos dados para conferir (valor e códigos). */
export function VerComprovante({
  pagamento,
  duplicados,
  aoFechar,
  confirmar,
  data,
  aoMudarData,
}: {
  pagamento: Payment
  /** Outros pagamentos que usam o mesmo ID de transação. */
  duplicados: Payment[]
  aoFechar: () => void
  confirmar: (() => void) | null
  /** Data em que o Pix foi pago (yyyy-mm-dd), usada na confirmação. */
  data: string
  aoMudarData: (v: string) => void
}) {
  const [imagem, setImagem] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    getDoc(doc(db, 'comprovantes', pagamento.id))
      .then((s) => setImagem(s.exists() ? ((s.data() as { imagem?: string }).imagem ?? null) : null))
      .catch(() => setImagem(null))
  }, [pagamento.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aoFechar])

  const enviadoEm = paraMillis(pagamento.comprovanteEm)

  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={aoFechar}>
      <div className="panel panel-destaque my-6 w-full max-w-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink">Comprovante de {pagamento.jogadorNome}</h2>
            {enviadoEm && (
              <p className="text-xs text-mute">
                Enviado em {new Date(enviadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
          </div>
          <button onClick={aoFechar} className="rounded-sm px-2 py-1 text-lg leading-none text-mute hover:bg-surface2 hover:text-ink" aria-label="Fechar">
            ×
          </button>
        </div>

        <dl className="mt-3 grid gap-2 rounded-sm border border-line bg-surface2 p-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-mute/80">Valor da cobrança</dt>
            <dd className="font-semibold text-ink">R$ {pagamento.valor.toFixed(2).replace('.', ',')}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-widest text-mute/80">Código de identificação</dt>
            <dd className="break-all font-mono text-xs text-ink">{pagamento.txid}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-widest text-mute/80">ID da transação informado</dt>
            <dd className="break-all font-mono text-xs text-ink">{pagamento.idTransacao || 'não informado'}</dd>
          </div>
        </dl>

        {duplicados.length > 0 && (
          <p className="mt-3 rounded-sm border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
            Atenção: este ID de transação já aparece em outro pagamento ({duplicados.map((d) => d.jogadorNome).join(', ')}). Um mesmo comprovante não
            vale para duas cobranças.
          </p>
        )}

        <div className="mt-3">
          {imagem === undefined && <p className="text-sm text-mute">Carregando comprovante...</p>}
          {imagem === null && <p className="text-sm text-mute/70">Nenhuma imagem enviada para esta cobrança.</p>}
          {imagem && (
            <a href={imagem} target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real">
              <img src={imagem} alt={`Comprovante de ${pagamento.jogadorNome}`} className="mx-auto max-h-[70vh] rounded-sm border border-line bg-white object-contain" />
            </a>
          )}
        </div>

        <p className="mt-3 text-xs text-mute">
          Confira no extrato do banco da associação se entrou um Pix do valor acima, com o mesmo ID de transação ou o código de identificação.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirmar && (
            <label className="flex items-center gap-2 text-xs text-mute">
              Pago em
              <input type="date" max={new Date().toISOString().slice(0, 10)} value={data} onChange={(e) => aoMudarData(e.target.value)} className="input w-auto" />
            </label>
          )}
          {confirmar && (
            <button onClick={confirmar} className="btn-primary">
              Confirmar pagamento
            </button>
          )}
          <button onClick={aoFechar} className="btn-ghost">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
