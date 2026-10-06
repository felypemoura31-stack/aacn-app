import { useEffect, useRef, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { aprovarSolicitacao, rejeitarSolicitacao } from '../lib/teams'
import { atualizarTimeNoCartaoPublico } from '../lib/publicCard'
import { Link } from 'react-router-dom'
import { TeamEditor } from '../components/TeamEditor'
import { TeamLogo } from './Teams'
import type { Team, TeamJoinRequest } from '../types'

export function RepresentativeRequests() {
  const { currentUser } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [requests, setRequests] = useState<TeamJoinRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editandoTime, setEditandoTime] = useState<Team | null>(null)
  const [membros, setMembros] = useState<Set<string> | null>(null)
  const corrigidos = useRef(new Set<string>())

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

  // Quem aparece como membro do time (cartão público com o timeId do time).
  useEffect(() => {
    if (teams.length === 0) return
    const q = query(collection(db, 'publicCards'), where('timeId', 'in', teams.map((t) => t.id).slice(0, 10)))
    return onSnapshot(q, (snap) => setMembros(new Set(snap.docs.map((d) => d.id))))
  }, [teams])

  // Auto-correção: jogador aprovado que ficou fora da lista de membros (aprovações antigas) volta a aparecer.
  useEffect(() => {
    if (!membros) return
    for (const r of requests) {
      if (r.status !== 'aprovado' || membros.has(r.jogadorUid) || corrigidos.current.has(r.id)) continue
      corrigidos.current.add(r.id)
      // refaz a aprovação inteira (idempotente): o cadastro do jogador (se ainda estiver neste time) e o cartão público.
      // O representante só consegue gravar se o jogador continua pedindo este time; senão o banco recusa, sem efeito.
      updateDoc(doc(db, 'players', r.jogadorUid), { timeAprovado: true, atualizadoEm: serverTimestamp() })
        .then(() => atualizarTimeNoCartaoPublico(r.jogadorUid, r.timeNome, r.timeId))
        .catch(() => {})
    }
  }, [membros, requests])

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
        await aprovarSolicitacao(r.id, r.jogadorUid, r.timeNome, r.timeId)
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

      <div className="mb-8 space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="panel flex items-center gap-3 p-4">
            <TeamLogo team={t} className="h-14 w-14" />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{t.nome}</p>
            <button onClick={() => setEditandoTime(t)} className="btn-primary">
              Editar time
            </button>
            <Link to={`/times/${t.id}`} className="btn-ghost">
              Ver perfil
            </Link>
          </div>
        ))}
      </div>

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

      {editandoTime && <TeamEditor team={editandoTime} podeEditarNome={false} onClose={() => setEditandoTime(null)} />}
    </div>
  )
}
