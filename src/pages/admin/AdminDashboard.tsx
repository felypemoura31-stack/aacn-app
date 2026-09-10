import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { STATUS_COLORS, STATUS_LABELS } from '../../lib/status'
import type { Player, PlayerStatus } from '../../types'

export function AdminDashboard() {
  const [players, setPlayers] = useState<Player[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<PlayerStatus | 'todos'>('todos')

  useEffect(() => {
    const q = query(collection(db, 'players'), orderBy('nomeCompleto'))
    return onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => d.data() as Player))
    })
  }, [])

  const filtrados = useMemo(() => {
    return players.filter((p) => {
      const matchBusca = p.nomeCompleto
        ?.toLowerCase()
        .includes(busca.toLowerCase())
      const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
      return matchBusca && matchStatus
    })
  }, [players, busca, filtroStatus])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900">
        Admin: Jogadores ({players.length})
      </h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="input max-w-xs"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as PlayerStatus | 'todos')}
          className="input max-w-xs"
        >
          <option value="todos">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="inadimplente">Inadimplente</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.uid} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <Link
                    to={`/admin/jogadores/${p.uid}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {p.nomeCompleto || '(sem nome)'}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{p.email}</td>
                <td className="px-4 py-2 text-slate-500">
                  {p.timeId ? (p.timeAprovado ? p.timeNome : `${p.timeNome} (pendente)`) : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[p.status]}`}
                  >
                    {STATUS_LABELS[p.status]}
                  </span>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Nenhum jogador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
