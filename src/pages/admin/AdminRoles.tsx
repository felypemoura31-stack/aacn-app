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
import { CARGOS_DELEGAVEIS, cargosDe, rotuloDoCargo } from '../../lib/roles'
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

  /** Liga ou desliga um cargo. A pessoa pode ter vários; o cargo principal volta a ser "jogador" (os delegados ficam em `cargos`). */
  async function alternarCargo(p: Player, cargo: UserRole, ligado: boolean) {
    if (!admin) return
    const atuais = cargosDe(p).filter((c) => c !== 'admin')
    const novos = ligado ? [...new Set([...atuais, cargo])] : atuais.filter((c) => c !== cargo)
    setErro(null)
    setBusyUid(p.uid)
    try {
      await updateDoc(doc(db, 'players', p.uid), {
        role: 'player',
        cargos: novos,
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
        Aqui você delega cargos aos jogadores, e cada pessoa pode ter <b className="text-ink">mais de um</b> (por exemplo, organizador e
        parceiro, mas não tesoureiro). O cargo de administrador só é definido direto no Firebase. Representantes de time são definidos
        em Admin: Times.
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
          const cargos = cargosDe(p)
          return (
            <div key={p.uid} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{p.nomeCompleto}</p>
                <p className="truncate text-xs text-mute">
                  {p.email}
                  {p.cargoAlteradoPor && !ehAdmin && cargos.length > 0 && <span className="text-mute/70"> · definido por {p.cargoAlteradoPor}</span>}
                </p>
              </div>
              {ehAdmin ? (
                <span className="rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
                  {rotuloDoCargo('admin')} (definido no Firebase)
                </span>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {CARGOS_DELEGAVEIS.map((c) => (
                    <label key={c.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        disabled={busyUid === p.uid}
                        checked={cargos.includes(c.value)}
                        onChange={(e) => alternarCargo(p, c.value, e.target.checked)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
