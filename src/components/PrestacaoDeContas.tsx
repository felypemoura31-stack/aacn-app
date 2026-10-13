import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { reais } from '../lib/credits'
import { rotuloDoMes } from '../lib/caixa'
import { paraMillis } from '../lib/status'
import type { PrestacaoContas } from '../types'

const quando = (v: unknown) => {
  const ms = paraMillis(v)
  return ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

const sinal = (n: number) => `${n < 0 ? '−' : ''}${reais(Math.abs(n))}`

function Mes({ c }: { c: PrestacaoContas }) {
  const ent = Object.entries(c.entradasPorCategoria ?? {}).sort((a, b) => b[1] - a[1])
  const sai = Object.entries(c.saidasPorCategoria ?? {}).sort((a, b) => b[1] - a[1])
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">{rotuloDoMes(c.mes)}</h3>
        <p className="text-[11px] text-mute">
          publicado por {c.publicadoPorNome} em {quando(c.publicadoEm)}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase text-mute/80">Entradas</p>
          <p className="font-bold text-ok">{reais(c.entradas)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-mute/80">Saídas</p>
          <p className="font-bold text-danger">{reais(c.saidas)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-mute/80">Saldo do mês</p>
          <p className={`font-bold ${c.saldoMes < 0 ? 'text-danger' : 'text-ink'}`}>{sinal(c.saldoMes)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-mute/80">Caixa no fim do mês</p>
          <p className={`font-bold ${c.saldoAcumulado < 0 ? 'text-danger' : 'text-gold'}`}>{sinal(c.saldoAcumulado)}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-4 text-xs sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-widest text-mute/80">De onde veio</p>
          {ent.length === 0 && <p className="text-mute/70">Sem entradas.</p>}
          <ul className="space-y-0.5">
            {ent.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2 text-mute">
                <span className="truncate">{k}</span>
                <b className="text-ok">{reais(v)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-widest text-mute/80">Onde foi usado</p>
          {sai.length === 0 && <p className="text-mute/70">Sem saídas.</p>}
          <ul className="space-y-0.5">
            {sai.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2 text-mute">
                <span className="truncate">{k}</span>
                <b className="text-danger">{reais(v)}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/** O que a diretoria publicou sobre o dinheiro da associação, mês a mês (Admin → Caixa → Publicar). */
export function PrestacaoDeContas() {
  const [contas, setContas] = useState<PrestacaoContas[] | null>(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'prestacaoContas'), (s) =>
      setContas(s.docs.map((d) => d.data() as PrestacaoContas).sort((a, b) => b.mes.localeCompare(a.mes))),
    )
  }, [])

  return (
    <section>
      <h2 className="mb-1 text-sm font-bold text-ink">Prestação de contas da associação</h2>
      <p className="mb-3 text-xs text-mute">O que a diretoria publicou sobre o dinheiro da associação: de onde veio e onde foi usado, mês a mês.</p>
      {contas === null && <p className="text-sm text-mute">Carregando...</p>}
      {contas && contas.length === 0 && (
        <p className="rounded-sm border border-line bg-surface px-4 py-6 text-center text-sm text-mute">Nenhuma prestação de contas publicada ainda.</p>
      )}
      <div className="space-y-3">
        {contas?.map((c) => (
          <Mes key={c.mes} c={c} />
        ))}
      </div>
    </section>
  )
}
