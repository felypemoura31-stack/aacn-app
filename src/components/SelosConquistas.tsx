import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { CONQUISTAS } from '../lib/conquistas'
import type { ConquistaResgatada } from '../types'

/** Selos das conquistas já resgatadas por um jogador (carteirinha, meus dados e ficha do admin). */
export function SelosConquistas({
  uid,
  titulo = 'Conquistas',
  className = 'mx-auto mt-6 w-full max-w-sm',
}: {
  uid: string
  titulo?: string
  className?: string
}) {
  const [ids, setIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'conquistas'), where('uid', '==', uid))
    return onSnapshot(
      q,
      (s) => setIds(new Set(s.docs.map((d) => (d.data() as ConquistaResgatada).conquista))),
      () => setIds(new Set()),
    )
  }, [uid])

  const ganhas = CONQUISTAS.filter((c) => ids?.has(c.id))

  return (
    <div className={`no-print panel p-5 ${className}`}>
      <h2 className="text-sm font-bold text-ink">
        {titulo} {ids && <span className="font-normal text-mute">({ganhas.length}/{CONQUISTAS.length})</span>}
      </h2>
      {ids === null && <p className="mt-2 text-xs text-mute">Carregando...</p>}
      {ids && ganhas.length === 0 && <p className="mt-2 text-xs text-mute/70">Nenhuma conquista ainda. Elas aparecem aqui quando forem desbloqueadas.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {ganhas.map((c) => (
          <span
            key={c.id}
            title={c.desc}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              c.grupo === 'noturnas' ? 'border-accent-hi/50 bg-accent/15 text-ink' : 'border-gold/50 bg-gold/10 text-gold'
            }`}
          >
            {c.icone} {c.titulo}
          </span>
        ))}
      </div>
    </div>
  )
}
