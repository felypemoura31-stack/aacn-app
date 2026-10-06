import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { JogadorResumo, Team } from '../types'

export function TeamLogo({ team, className }: { team: Pick<Team, 'nome' | 'logoUrl'>; className: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white ${className}`}>
      {team.logoUrl ? (
        <img src={team.logoUrl} alt={`Logo ${team.nome}`} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-2xl font-bold text-slate-400">{team.nome.trim().slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )
}

export function Teams() {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [membros, setMembros] = useState<JogadorResumo[]>([])

  useEffect(() => {
    const unsubT = onSnapshot(query(collection(db, 'teams'), orderBy('nome')), (snap) =>
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team)),
    )
    const unsubM = onSnapshot(collection(db, 'publicCards'), (snap) =>
      setMembros(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as JogadorResumo)),
    )
    return () => {
      unsubT()
      unsubM()
    }
  }, [])

  const contagem = useMemo(() => {
    const m = new Map<string, number>()
    for (const j of membros) {
      if (j.timeId) m.set(j.timeId, (m.get(j.timeId) ?? 0) + 1)
    }
    // o representante conta como membro do time que lidera, mesmo sem pedido aprovado
    for (const t of teams ?? []) {
      const rep = t.representanteUid ? membros.find((j) => j.uid === t.representanteUid) : null
      if (rep && rep.timeId !== t.id) m.set(t.id, (m.get(t.id) ?? 0) + 1)
    }
    return m
  }, [membros, teams])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Times</h1>

      {teams === null && <p className="text-sm text-mute">Carregando...</p>}
      {teams?.length === 0 && <p className="text-sm text-mute/70">Nenhum time cadastrado ainda.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {teams?.map((t) => (
          <Link
            key={t.id}
            to={`/times/${t.id}`}
            className="panel flex flex-col items-center gap-3 p-4 text-center transition-colors hover:bg-surface2"
          >
            <TeamLogo team={t} className="h-24 w-24" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{t.nome}</p>
              <p className="truncate text-xs text-mute">{t.cidade || 'Cidade não informada'}</p>
              <p className="mt-1 text-xs text-gold">
                {contagem.get(t.id) ?? 0} {(contagem.get(t.id) ?? 0) === 1 ? 'membro' : 'membros'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
