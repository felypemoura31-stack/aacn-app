import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { aprovarSolicitacao, rejeitarSolicitacao } from '../lib/teams'
import type { Team, TeamJoinRequest } from '../types'

export function RepresentativeRequests() {
  const { currentUser } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [requests, setRequests] = useState<TeamJoinRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) return
    const q = query(
      collection(db, 'teams'),
      where('representanteUid', '==', currentUser.uid),
    )
    return onSnapshot(q, (snap) => {
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team))
    })
  }, [currentUser])

  useEffect(() => {
    if (teams.length === 0) {
      setRequests([])
      return
    }
    const teamIds = teams.map((t) => t.id)
    const q = query(
      collection(db, 'teamJoinRequests'),
      where('timeId', 'in', teamIds.slice(0, 10)),
      orderBy('criadoEm', 'desc'),
    )
    return onSnapshot(q, (snap) => {
      setRequests(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TeamJoinRequest),
      )
    })
  }, [teams])

  if (!currentUser) return null

  if (teams.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 text-xl font-bold text-ink">
          Solicitações do time
        </h1>
        <p className="text-sm text-mute">
          Você não é representante de nenhum time no momento.
        </p>
      </div>
    )
  }

  const pendentes = requests.filter((r) => r.status === 'pendente')
  const resolvidas = requests.filter((r) => r.status !== 'pendente')

  async function handle(action: 'aprovar' | 'rejeitar', r: TeamJoinRequest) {
    setBusyId(r.id)
    try {
      if (action === 'aprovar')
        await aprovarSolicitacao(r.id, r.jogadorUid, r.timeNome)
      else await rejeitarSolicitacao(r.id, r.jogadorUid)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold text-ink">
        Solicitações do time
      </h1>
      <p className="mb-6 text-sm text-mute">
        Times: {teams.map((t) => t.nome).join(', ')}
      </p>

      <h2 className="mb-2 text-sm font-semibold text-ink">Pendentes</h2>
      {pendentes.length === 0 && (
        <p className="mb-6 text-sm text-mute/70">Nenhuma solicitação pendente.</p>
      )}
      <div className="mb-8 space-y-2">
        {pendentes.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between panel px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {r.jogadorNome}
              </p>
              <p className="text-xs text-mute">quer entrar em {r.timeNome}</p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={busyId === r.id}
                onClick={() => handle('aprovar', r)}
                className="rounded-sm bg-ok px-3 py-1.5 text-xs font-semibold text-white hover:bg-ok/80 disabled:opacity-60"
              >
                Aprovar
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => handle('rejeitar', r)}
                className="rounded-sm bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/80 disabled:opacity-60"
              >
                Recusar
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">Histórico</h2>
      <div className="space-y-2">
        {resolvidas.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-sm border border-line px-4 py-2 text-sm text-mute"
          >
            <span>
              {r.jogadorNome} — {r.timeNome}
            </span>
            <span
              className={
                r.status === 'aprovado' ? 'text-ok' : 'text-danger'
              }
            >
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
