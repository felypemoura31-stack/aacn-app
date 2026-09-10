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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">
          Verificação de associado AACN
        </p>

        {card === undefined && <p className="text-slate-500">Carregando...</p>}

        {card === null && (
          <p className="text-red-600">Carteirinha não encontrada.</p>
        )}

        {card && (
          <>
            <div className="mx-auto mb-3 h-28 w-24 overflow-hidden rounded border border-slate-300 bg-slate-100">
              {card.fotoUrl && (
                <img
                  src={card.fotoUrl}
                  alt={card.nomeCompleto}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <p className="text-lg font-bold text-slate-900">
              {card.nomeCompleto}
            </p>
            <p className="mb-3 text-sm text-slate-500">
              Time: {card.timeNome ?? 'Nenhum'}
            </p>
            <span
              className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_COLORS[card.status]}`}
            >
              {STATUS_LABELS[card.status]}
            </span>
            <p className="mt-4 text-xs text-slate-400">
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
