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
import { useAuth } from '../../contexts/AuthContext'
import {
  adminAdicionarParticipante,
  adminRemoverParticipante,
  formatarCreditos,
  reais,
} from '../../lib/credits'
import type { Game, JogadorResumo, PagoCom, Participation } from '../../types'

export function AdminGames() {
  const { player: admin } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [parts, setParts] = useState<Participation[]>([])
  const [players, setPlayers] = useState<JogadorResumo[]>([])
  const [aberto, setAberto] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [data, setData] = useState('')
  const [valor, setValor] = useState(10)
  const [custo, setCusto] = useState(10)

  const [novoUid, setNovoUid] = useState('')
  const [novoModo, setNovoModo] = useState<PagoCom>('creditos')

  useEffect(() => {
    const unsubG = onSnapshot(query(collection(db, 'games'), orderBy('data', 'desc')), (snap) =>
      setGames(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Game)),
    )
    const unsubP = onSnapshot(collection(db, 'participations'), (snap) =>
      setParts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation)),
    )
    const unsubJ = onSnapshot(query(collection(db, 'publicCards'), orderBy('nomeCompleto')), (snap) =>
      setPlayers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as JogadorResumo)),
    )
    return () => {
      unsubG()
      unsubP()
      unsubJ()
    }
  }, [])

  const autor = () => ({ uid: admin!.uid, nome: admin!.nomeCompleto })

  async function criar(e: FormEvent) {
    e.preventDefault()
    await addDoc(collection(db, 'games'), {
      nome: nome.trim(),
      data,
      valor,
      custoCreditos: custo,
      status: 'aberto',
      criadoEm: serverTimestamp(),
    })
    setNome('')
    setData('')
  }

  async function alternar(g: Game) {
    await updateDoc(doc(db, 'games', g.id), {
      status: g.status === 'aberto' ? 'encerrado' : 'aberto',
    })
  }

  async function adicionar(g: Game) {
    const jogador = players.find((p) => p.uid === novoUid)
    if (!jogador) return
    setErro(null)
    try {
      await adminAdicionarParticipante(g, jogador, novoModo, autor())
      setNovoUid('')
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function remover(p: Participation) {
    setErro(null)
    try {
      await adminRemoverParticipante(p, autor())
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Jogos</h1>

      <form onSubmit={criar} className="panel mb-8 space-y-3 p-4">
        <h2 className="text-sm font-bold text-ink">Novo jogo</h2>
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome do jogo" value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
          <input required type="date" value={data} onChange={(e) => setData(e.target.value)} className="input" />
          <label className="text-xs text-mute">
            Valor em dinheiro (R$)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => {
                setValor(Number(e.target.value))
                setCusto(Number(e.target.value))
              }}
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-mute">
            Custo em créditos
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={custo}
              onChange={(e) => setCusto(Number(e.target.value))}
              className="input mt-1"
            />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Criar jogo
        </button>
      </form>

      {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}

      <div className="space-y-3">
        {games.length === 0 && <p className="text-sm text-mute/70">Nenhum jogo cadastrado.</p>}
        {games.map((g) => {
          const lista = parts.filter((p) => p.gameId === g.id && p.status !== 'removida')
          const expandido = aberto === g.id
          return (
            <div key={g.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{g.nome}</p>
                  <p className="text-xs text-mute">
                    {new Date(g.data + 'T12:00').toLocaleDateString('pt-BR')} · {reais(g.valor)} /{' '}
                    {formatarCreditos(g.custoCreditos)} créditos · {lista.length} inscritos ·{' '}
                    {g.status === 'aberto' ? 'inscrições abertas' : 'encerrado'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => alternar(g)} className="btn-ghost">
                    {g.status === 'aberto' ? 'Encerrar' : 'Reabrir'}
                  </button>
                  <button onClick={() => setAberto(expandido ? null : g.id)} className="btn-ghost">
                    {expandido ? 'Fechar' : 'Inscritos'}
                  </button>
                </div>
              </div>

              {expandido && (
                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  {lista.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm text-mute">
                      <span className="text-ink">{p.jogadorNome}</span>
                      <span className="flex items-center gap-3">
                        {p.pagoCom === 'creditos'
                          ? `${formatarCreditos(p.creditosDebitados)} créditos`
                          : 'dinheiro'}
                        <button onClick={() => remover(p)} className="text-xs text-danger hover:underline">
                          Remover
                        </button>
                      </span>
                    </div>
                  ))}
                  {lista.length === 0 && <p className="text-xs text-mute/70">Ninguém inscrito ainda.</p>}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <select value={novoUid} onChange={(e) => setNovoUid(e.target.value)} className="input w-auto flex-1">
                      <option value="">Adicionar jogador...</option>
                      {players
                        .filter((p) => !lista.some((x) => x.uid === p.uid))
                        .map((p) => (
                          <option key={p.uid} value={p.uid}>
                            {p.nomeCompleto}
                          </option>
                        ))}
                    </select>
                    <select value={novoModo} onChange={(e) => setNovoModo(e.target.value as PagoCom)} className="input w-auto">
                      <option value="creditos">Debitar créditos</option>
                      <option value="dinheiro">Pagou em dinheiro</option>
                    </select>
                    <button disabled={!novoUid} onClick={() => adicionar(g)} className="btn-primary">
                      Adicionar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
