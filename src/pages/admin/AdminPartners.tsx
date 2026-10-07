import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { PartnerEditor } from '../../components/PartnerEditor'
import type { Partner, Player } from '../../types'

export function AdminPartners() {
  const [parceiros, setParceiros] = useState<Partner[]>([])
  const [editando, setEditando] = useState<Partner | null | undefined>(undefined) // undefined = fechado, null = novo
  const [nomes, setNomes] = useState<Record<string, string>>({})

  useEffect(() => {
    const q = query(collection(db, 'partners'), orderBy('nome'))
    return onSnapshot(q, (snap) => setParceiros(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partner)))
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'players'), (snap) => {
      const m: Record<string, string> = {}
      snap.docs.forEach((d) => (m[d.id] = (d.data() as Player).nomeCompleto))
      setNomes(m)
    })
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Parceiros</h1>
        <button onClick={() => setEditando(null)} className="btn-primary">
          Novo parceiro
        </button>
      </div>

      <div className="space-y-2">
        {parceiros.length === 0 && <p className="text-sm text-mute/70">Nenhum parceiro cadastrado.</p>}
        {parceiros.map((p) => (
          <div key={p.id} className="panel flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white">
              {p.logoUrl ? <img src={p.logoUrl} alt="" className="max-h-full max-w-full object-contain" /> : <span className="font-bold text-slate-400">{p.nome.slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">
                {p.nome}
                {!p.ativo && <span className="ml-2 text-[10px] uppercase tracking-widest text-mute">inativo</span>}
              </p>
              <p className="truncate text-xs text-mute">
                {p.categoria} · {p.desconto}
              </p>
              {p.donoUid && <p className="truncate text-[11px] text-mute/80">Lojista: {nomes[p.donoUid] ?? '—'}</p>}
            </div>
            <button onClick={() => setEditando(p)} className="btn-ghost">
              Editar
            </button>
            <button
              onClick={() => window.confirm(`Apagar o parceiro ${p.nome}?`) && deleteDoc(doc(db, 'partners', p.id))}
              className="btn-ghost text-danger"
            >
              Apagar
            </button>
          </div>
        ))}
      </div>

      {editando !== undefined && <PartnerEditor parceiro={editando} onClose={() => setEditando(undefined)} />}
    </div>
  )
}
