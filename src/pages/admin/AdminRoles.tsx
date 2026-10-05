import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { CARGOS_DELEGAVEIS, rotuloDoCargo } from '../../lib/roles'
import type { Player, UserRole } from '../../types'

export function AdminRoles() {
  const { player: admin } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [busca, setBusca] = useState('')
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'players'), orderBy('nomeCompleto'))
    return onSnapshot(q, (snap) => setPlayers(snap.docs.map((d) => d.data() as Player)))
  }, [])

  const filtrados = useMemo(
    () => players.filter((p) => p.nomeCompleto?.toLowerCase().includes(busca.toLowerCase())),
    [players, busca],
  )

  async function mudarCargo(p: Player, novo: UserRole) {
    if (!admin || novo === p.role) return
    setErro(null)
    setBusyUid(p.uid)
    try {
      await updateDoc(doc(db, 'players', p.uid), {
        role: novo,
        cargoAlteradoPor: admin.nomeCompleto,
        cargoAlteradoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })
    } catch {
      setErro('Não foi possível alterar o cargo. Tente novamente.')
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-xl font-bold text-ink">Admin: Cargos</h1>
      <p className="mb-6 text-sm text-mute">
        Aqui você delega cargos aos jogadores. O cargo de administrador só é definido direto no
        Firebase. Representantes de time são definidos em Admin: Times.
      </p>

      <div className="panel mb-6 p-4">
        <h2 className="mb-2 text-sm font-bold text-ink">Cargos disponíveis</h2>
        <ul className="space-y-1 text-sm text-mute">
          {CARGOS_DELEGAVEIS.map((c) => (
            <li key={c.value}>
              <b className="text-ink">{c.label}</b>: {c.descricao}
            </li>
          ))}
        </ul>
      </div>

      <input
        placeholder="Buscar jogador..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="input mb-4 max-w-xs"
      />

      {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}

      <div className="space-y-2">
        {filtrados.map((p) => {
          const ehAdmin = p.role === 'admin'
          return (
            <div key={p.uid} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-ink">{p.nomeCompleto}</p>
                <p className="text-xs text-mute">
                  {p.email}
                  {p.cargoAlteradoPor && !ehAdmin && p.role !== 'player' && (
                    <span className="text-mute/70"> · definido por {p.cargoAlteradoPor}</span>
                  )}
                </p>
              </div>
              {ehAdmin ? (
                <span className="rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
                  {rotuloDoCargo('admin')} (definido no Firebase)
                </span>
              ) : (
                <div className="w-full sm:w-64">
                <select
                  value={p.role}
                  disabled={busyUid === p.uid}
                  onChange={(e) => mudarCargo(p, e.target.value as UserRole)}
                  className="input"
                >
                  <option value="player">Jogador (sem cargo)</option>
                  {CARGOS_DELEGAVEIS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
