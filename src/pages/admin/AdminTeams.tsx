import { useEffect, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import type { Player, Team } from '../../types'

export function AdminTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    const qTeams = query(collection(db, 'teams'), orderBy('nome'))
    const unsubTeams = onSnapshot(qTeams, (snap) => {
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team))
    })
    const qPlayers = query(collection(db, 'players'), orderBy('nomeCompleto'))
    const unsubPlayers = onSnapshot(qPlayers, (snap) => {
      setPlayers(snap.docs.map((d) => d.data() as Player))
    })
    return () => {
      unsubTeams()
      unsubPlayers()
    }
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    setCriando(true)
    try {
      await addDoc(collection(db, 'teams'), {
        nome: novoNome.trim(),
        representanteUid: null,
        representanteNome: null,
        representanteEmail: null,
        criadoEm: serverTimestamp(),
      })
      setNovoNome('')
    } finally {
      setCriando(false)
    }
  }

  async function handleSetRepresentante(team: Team, uid: string) {
    const jogador = players.find((p) => p.uid === uid)
    await updateDoc(doc(db, 'teams', team.id), {
      representanteUid: uid || null,
      representanteNome: jogador ? jogador.nomeCompleto : null,
      representanteEmail: jogador ? jogador.email : null,
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Admin: Times</h1>

      <form
        onSubmit={handleCreate}
        className="mb-6 flex gap-2 panel p-4"
      >
        <input
          placeholder="Nome do novo time"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="input"
        />
        <button
          type="submit"
          disabled={criando}
          className="btn-primary whitespace-nowrap"
        >
          Criar time
        </button>
      </form>

      <div className="space-y-3">
        {teams.map((team) => (
          <div
            key={team.id}
            className="panel p-4"
          >
            <p className="mb-2 font-semibold text-ink">{team.nome}</p>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-mute">
                Representante
              </span>
              <select
                value={team.representanteUid ?? ''}
                onChange={(e) => handleSetRepresentante(team, e.target.value)}
                className="input"
              >
                <option value="">Nenhum</option>
                {players.map((p) => (
                  <option key={p.uid} value={p.uid}>
                    {p.nomeCompleto} ({p.email})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
        {teams.length === 0 && (
          <p className="text-sm text-mute/70">Nenhum time cadastrado ainda.</p>
        )}
      </div>
    </div>
  )
}
