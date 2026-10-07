import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { ConferirConquistas } from '../../components/ConferirConquistas'
import { STATUS_COLORS, STATUS_LABELS, formatarData, statusEfetivo } from '../../lib/status'
import type { Player, PlayerStatus } from '../../types'

type Campo = 'nome' | 'email' | 'time' | 'status' | 'vencimento'
type Direcao = 'asc' | 'desc'

const ROTULOS: Record<Campo, string> = {
  nome: 'Nome',
  email: 'E-mail',
  time: 'Time',
  status: 'Status',
  vencimento: 'Vencimento',
}

/** Texto do time como aparece na lista (vazio = sem time). */
const textoDoTime = (p: Player) => (p.timeId ? (p.timeAprovado ? p.timeNome : `${p.timeNome} (pendente)`) : '') ?? ''

/** Valor de cada coluna para ordenar; vazio fica sempre no fim, em qualquer direção. */
function valorDe(p: Player, campo: Campo): string | number | null {
  switch (campo) {
    case 'nome':
      return p.nomeCompleto?.trim() || null
    case 'email':
      return p.email || null
    case 'time':
      return textoDoTime(p) || null
    case 'status':
      return STATUS_LABELS[statusEfetivo(p)]
    case 'vencimento':
      return p.vencimento ?? null
  }
}

function comparar(a: Player, b: Player, campo: Campo, dir: Direcao) {
  const x = valorDe(a, campo)
  const y = valorDe(b, campo)
  if (x === null && y === null) return 0
  if (x === null) return 1
  if (y === null) return -1
  const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { sensitivity: 'base' })
  return dir === 'asc' ? r : -r
}

export function AdminDashboard() {
  const [players, setPlayers] = useState<Player[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<PlayerStatus | 'todos'>('todos')
  const [ordem, setOrdem] = useState<{ campo: Campo; dir: Direcao }>({ campo: 'nome', dir: 'asc' })

  useEffect(() => {
    const q = query(collection(db, 'players'), orderBy('nomeCompleto'))
    return onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => d.data() as Player))
    })
  }, [])

  const filtrados = useMemo(() => {
    return players
      .filter((p) => {
        const matchBusca = p.nomeCompleto?.toLowerCase().includes(busca.toLowerCase())
        const matchStatus = filtroStatus === 'todos' || statusEfetivo(p) === filtroStatus
        return matchBusca && matchStatus
      })
      .sort((a, b) => comparar(a, b, ordem.campo, ordem.dir))
  }, [players, busca, filtroStatus, ordem])

  /** Clicar na coluna ordena de A→Z; clicar de novo inverte. */
  function ordenarPor(campo: Campo) {
    setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }))
  }

  const seta = (campo: Campo) => (ordem.campo === campo ? (ordem.dir === 'asc' ? '▲' : '▼') : '↕')

  const Cabecalho = ({ campo }: { campo: Campo }) => (
    <th className="px-4 py-2" aria-sort={ordem.campo === campo ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => ordenarPor(campo)}
        className={`flex items-center gap-1 uppercase hover:text-ink ${ordem.campo === campo ? 'text-ink' : ''}`}
        title={`Ordenar por ${ROTULOS[campo].toLowerCase()}`}
      >
        {ROTULOS[campo]}
        <span className={ordem.campo === campo ? 'text-accent-hi' : 'text-mute/60'} aria-hidden="true">
          {seta(campo)}
        </span>
      </button>
    </th>
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">
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

      <ConferirConquistas />

      {/* celular: ordenar por um campo, com botão para inverter */}
      <div className="mb-3 flex items-center gap-2 md:hidden">
        <label className="text-xs text-mute" htmlFor="ordenar">
          Ordenar por
        </label>
        <select
          id="ordenar"
          value={ordem.campo}
          onChange={(e) => setOrdem({ campo: e.target.value as Campo, dir: 'asc' })}
          className="input max-w-[11rem]"
        >
          {(Object.keys(ROTULOS) as Campo[]).map((c) => (
            <option key={c} value={c}>
              {ROTULOS[c]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOrdem((o) => ({ ...o, dir: o.dir === 'asc' ? 'desc' : 'asc' }))}
          className="btn-ghost"
          aria-label={ordem.dir === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
        >
          {ordem.dir === 'asc' ? '▲ A→Z' : '▼ Z→A'}
        </button>
      </div>

      {/* celular: um cartão por jogador (a tabela cortaria as colunas) */}
      <div className="space-y-2 md:hidden">
        {filtrados.map((p) => (
          <Link key={p.uid} to={`/admin/jogadores/${p.uid}`} className="panel block p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-semibold text-ink">{p.nomeCompleto || '(sem nome)'}</p>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[statusEfetivo(p)]}`}>
                {STATUS_LABELS[statusEfetivo(p)]}
              </span>
            </div>
            <p className="mt-1 break-all text-xs text-mute">{p.email}</p>
            <p className="mt-1 text-xs text-mute">
              {textoDoTime(p) || 'Sem time'} · vence {formatarData(p.vencimento)}
            </p>
          </Link>
        ))}
        {filtrados.length === 0 && <p className="py-6 text-center text-sm text-mute/70">Nenhum jogador encontrado.</p>}
      </div>

      <div className="hidden overflow-hidden rounded-sm border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface2 text-xs text-mute">
            <tr>
              <Cabecalho campo="nome" />
              <Cabecalho campo="email" />
              <Cabecalho campo="time" />
              <Cabecalho campo="status" />
              <Cabecalho campo="vencimento" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.uid} className="border-t border-line">
                <td className="px-4 py-2">
                  <Link
                    to={`/admin/jogadores/${p.uid}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {p.nomeCompleto || '(sem nome)'}
                  </Link>
                </td>
                <td className="px-4 py-2 text-mute">{p.email}</td>
                <td className="px-4 py-2 text-mute">{textoDoTime(p) || '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[statusEfetivo(p)]}`}
                  >
                    {STATUS_LABELS[statusEfetivo(p)]}
                  </span>
                </td>
                <td className="px-4 py-2 text-mute">{formatarData(p.vencimento)}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-mute/70">
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
