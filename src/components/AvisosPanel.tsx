import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { formatarData, paraMillis } from '../lib/status'
import type { Aviso } from '../types'

/** Mural de avisos da diretoria e da organização (fixados primeiro, depois os mais recentes). */
export function AvisosPanel({ limite = 3 }: { limite?: number }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  useEffect(() => {
    const q = query(collection(db, 'avisos'), orderBy('criadoEm', 'desc'))
    return onSnapshot(q, (snap) => setAvisos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso)))
  }, [])

  const ordenados = [...avisos].sort((a, b) => Number(!!b.fixado) - Number(!!a.fixado)).slice(0, limite)
  if (ordenados.length === 0) return null

  return (
    <section className="no-print mb-6 space-y-2">
      <h2 className="text-sm font-semibold text-ink">Avisos</h2>
      {ordenados.map((a) => (
        <article key={a.id} className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-ink">
              {a.fixado && <span className="mr-2 rounded-sm bg-gold/20 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-gold">Fixado</span>}
              {a.titulo}
            </h3>
            <span className="shrink-0 text-[11px] text-mute/80">{formatarData(paraMillis(a.criadoEm))}</span>
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-mute">{a.texto}</p>
          <p className="mt-2 text-[11px] text-mute/70">por {a.autorNome}</p>
        </article>
      ))}
    </section>
  )
}
