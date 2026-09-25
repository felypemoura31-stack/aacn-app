import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { STATUS_COLORS, STATUS_LABELS, isEmDia } from '../lib/status'
import type { PlayerStatus } from '../types'

interface PublicCard {
  nomeCompleto: string
  fotoUrl: string | null
  timeNome: string | null
  status: PlayerStatus
}

export function Verify() {
  const { uid } = useParams<{ uid: string }>()
  const [card, setCard] = useState<PublicCard | null | undefined>(undefined)

  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'publicCards', uid)).then((snap) => {
      setCard(snap.exists() ? (snap.data() as PublicCard) : null)
    })
  }, [uid])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="chamfer w-full max-w-sm panel p-6 text-center">
        <img
          src="/logo.png"
          alt="AACN"
          className="mx-auto mb-3 h-16 w-16 rounded-full ring-2 ring-accent-hi/60"
        />
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-mute">
          Verificação de associado
        </p>

        {card === undefined && <p className="text-mute">Carregando...</p>}

        {card === null && (
          <p className="text-danger">Carteirinha não encontrada.</p>
        )}

        {card && (
          <>
            <div className="mx-auto mb-3 h-28 w-24 overflow-hidden rounded border border-line bg-surface2">
              {card.fotoUrl && (
                <img
                  src={card.fotoUrl}
                  alt={card.nomeCompleto}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <p className="text-lg font-bold text-ink">
              {card.nomeCompleto}
            </p>
            <p className="mb-3 text-sm text-mute">
              Time: {card.timeNome ?? 'Nenhum'}
            </p>
            <span
              className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_COLORS[card.status]}`}
            >
              {STATUS_LABELS[card.status]}
            </span>
            <p className="mt-4 text-xs text-mute/70">
              {isEmDia(card.status)
                ? 'Associado em dia — elegível a descontos de parceiros.'
                : 'Associado não está em dia com a associação.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
