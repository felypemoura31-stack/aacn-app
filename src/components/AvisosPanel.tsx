import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { formatarData, paraMillis } from '../lib/status'
import type { Aviso } from '../types'

/** Mural de avisos da diretoria e da organização (fixados primeiro, depois os mais recentes). Compacto: um painel só. */
export function AvisosPanel({ limite = 2, className = '' }: { limite?: number; className?: string }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [todos, setTodos] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'avisos'), orderBy('criadoEm', 'desc'))
    return onSnapshot(q, (snap) => setAvisos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso)))
  }, [])

  const ordenados = [...avisos].sort((a, b) => Number(!!b.fixado) - Number(!!a.fixado))
  if (ordenados.length === 0) return null
  const visiveis = todos ? ordenados : ordenados.slice(0, limite)

  return (
    <section className={`no-print panel ${className}`}>
      <h2 className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-widest text-mute/80">Avisos</h2>
      <div className="divide-y divide-line">
        {visiveis.map((a) => (
          <article key={a.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">
                {a.fixado && <span className="mr-2 rounded-sm bg-gold/20 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-gold">Fixado</span>}
                {a.titulo}
              </h3>
              <span className="shrink-0 text-[11px] text-mute/80">{formatarData(paraMillis(a.criadoEm))}</span>
            </div>
            <p className={`mt-1 whitespace-pre-line text-sm text-mute ${todos ? '' : 'line-clamp-2'}`}>{a.texto}</p>
          </article>
        ))}
      </div>
      {ordenados.length > limite && (
        <button onClick={() => setTodos((v) => !v)} className="w-full border-t border-line px-4 py-2 text-xs text-mute hover:text-ink">
          {todos ? 'Mostrar menos' : `Ver todos (${ordenados.length})`}
        </button>
      )}
    </section>
  )
}
