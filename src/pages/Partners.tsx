import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { CATEGORIAS_PARCEIRO } from '../lib/parceiros'
import { linkWhatsapp } from '../lib/whatsapp'
import { statusEfetivo } from '../lib/status'
import type { Partner } from '../types'

export function Partners() {
  const { player } = useAuth()
  const [parceiros, setParceiros] = useState<Partner[] | null>(null)
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'partners'), orderBy('nome'))
    return onSnapshot(q, (snap) => setParceiros(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partner)))
  }, [])

  const lista = useMemo(
    () =>
      (parceiros ?? [])
        .filter((p) => p.ativo)
        .filter((p) => !categoria || p.categoria === categoria)
        .filter((p) => !busca || `${p.nome} ${p.desconto} ${p.descricao ?? ''}`.toLowerCase().includes(busca.toLowerCase())),
    [parceiros, categoria, busca],
  )

  const emDia = player ? statusEfetivo(player) === 'pago' : false

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold text-ink">Parceiros</h1>
      <p className="mb-4 text-sm text-mute">
        Descontos para associados em dia com a mensalidade. Mostre o QR da sua carteirinha no estabelecimento.
      </p>

      {player && (
        <p
          className={`mb-5 rounded-sm border px-4 py-2 text-sm ${
            emDia ? 'border-ok/40 bg-ok/10 text-ok' : 'border-warn/40 bg-warn/10 text-warn'
          }`}
        >
          {emDia ? 'Sua mensalidade está em dia: você pode usar os benefícios.' : 'Regularize sua mensalidade para usar os benefícios.'}
        </p>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <input placeholder="Buscar parceiro ou benefício..." value={busca} onChange={(e) => setBusca(e.target.value)} className="input max-w-xs" />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input max-w-xs">
          <option value="">Todas as categorias</option>
          {CATEGORIAS_PARCEIRO.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {parceiros === null && <p className="text-sm text-mute">Carregando...</p>}
      {parceiros && lista.length === 0 && <p className="text-sm text-mute/70">Nenhum parceiro encontrado.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {lista.map((p) => {
          const zap = p.telefone ? linkWhatsapp(p.telefone, 'Olá! Sou associado da AACN.') : null
          return (
            <article key={p.id} className="panel p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white">
                  {p.logoUrl ? (
                    <img src={p.logoUrl} alt={`Logo ${p.nome}`} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-lg font-bold text-slate-400">{p.nome.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-ink">{p.nome}</h2>
                  <p className="text-[11px] uppercase tracking-widest text-mute/80">{p.categoria}</p>
                </div>
              </div>
              <p className="mt-3 rounded-sm bg-gold/15 px-3 py-2 text-sm font-semibold text-gold">{p.desconto}</p>
              {p.descricao && <p className="mt-2 text-sm text-mute">{p.descricao}</p>}
              {p.endereco && <p className="mt-2 text-xs text-mute">{p.endereco}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {zap && (
                  <a href={zap} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                    WhatsApp
                  </a>
                )}
                {p.link && (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                    Instagram/site
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
