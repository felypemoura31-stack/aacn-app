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
  promoverDaEspera,
  reais,
} from '../../lib/credits'
import { baixarCsv } from '../../lib/csv'
import { urlHttp } from '../../lib/redes'
import { formatarData, paraMillis } from '../../lib/status'
import type { Game, JogadorResumo, Participation } from '../../types'

interface FormJogo {
  nome: string
  data: string
  horario: string
  local: string
  localLink: string
  descricao: string
  valor: number
  custo: number
  vagas: string
}

const VAZIO: FormJogo = { nome: '', data: '', horario: '', local: '', localLink: '', descricao: '', valor: 10, custo: 10, vagas: '' }

function dadosDoJogo(f: FormJogo) {
  const link = f.localLink.trim()
  const url = link ? urlHttp(link) : null
  if (link && !url) throw new Error('O link do mapa não é um endereço http/https válido.')
  const vagas = f.vagas.trim() === '' ? null : Number(f.vagas)
  if (vagas !== null && (!Number.isInteger(vagas) || vagas < 0)) throw new Error('As vagas devem ser um número inteiro (ou vazio, para sem limite).')
  return {
    nome: f.nome.trim(),
    data: f.data,
    horario: f.horario || null,
    local: f.local.trim() || null,
    localLink: url,
    descricao: f.descricao.trim() || null,
    valor: f.valor,
    custoCreditos: f.custo,
    vagas,
  }
}

function Campos({ f, set, editando }: { f: FormJogo; set: (f: FormJogo) => void; editando?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <input required placeholder="Nome do jogo" value={f.nome} onChange={(e) => set({ ...f, nome: e.target.value })} className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input required type="date" value={f.data} onChange={(e) => set({ ...f, data: e.target.value })} className="input" />
        <input type="time" value={f.horario} onChange={(e) => set({ ...f, horario: e.target.value })} className="input" />
      </div>
      <input maxLength={120} placeholder="Local (campo, endereço)" value={f.local} onChange={(e) => set({ ...f, local: e.target.value })} className="input" />
      <input maxLength={300} placeholder="Link do mapa (Google Maps)" value={f.localLink} onChange={(e) => set({ ...f, localLink: e.target.value })} className="input" />
      <textarea
        maxLength={1000}
        rows={3}
        placeholder="Descrição (regras do jogo, o que levar, horários...)"
        value={f.descricao}
        onChange={(e) => set({ ...f, descricao: e.target.value })}
        className="input col-span-2"
      />
      <label className="text-xs text-mute">
        Valor em dinheiro (R$)
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={f.valor}
          onChange={(e) => {
            const v = Number(e.target.value)
            // por padrão o custo em créditos acompanha o valor, enquanto forem iguais
            set({ ...f, valor: v, custo: f.custo === f.valor || !editando ? v : f.custo })
          }}
          className="input mt-1"
        />
      </label>
      <label className="text-xs text-mute">
        Custo em créditos
        <input required type="number" min="0" step="0.01" value={f.custo} onChange={(e) => set({ ...f, custo: Number(e.target.value) })} className="input mt-1" />
      </label>
      <label className="col-span-2 text-xs text-mute">
        Vagas (deixe vazio para sem limite; passando disso entra lista de espera)
        <input type="number" min="0" step="1" value={f.vagas} onChange={(e) => set({ ...f, vagas: e.target.value })} className="input mt-1" />
      </label>
    </div>
  )
}

export function AdminGames() {
  const { player: admin } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [parts, setParts] = useState<Participation[]>([])
  const [players, setPlayers] = useState<JogadorResumo[]>([])
  const [aberto, setAberto] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [novo, setNovo] = useState<FormJogo>(VAZIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [edit, setEdit] = useState<FormJogo>(VAZIO)

  const [novoUid, setNovoUid] = useState('')
  const [novoModo, setNovoModo] = useState<'creditos' | 'dinheiro'>('creditos')

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

  // Inscrever/cancelar mexe em créditos e dinheiro: só admin e tesoureiro. O organizador só vê a lista.
  const gerenciaInscricoes = admin?.role === 'admin' || admin?.role === 'tesoureiro'

  const autor = () => ({ uid: admin!.uid, nome: admin!.nomeCompleto })

  async function criar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      await addDoc(collection(db, 'games'), {
        ...dadosDoJogo(novo),
        inscritos: 0,
        espera: 0,
        status: 'aberto',
        criadoEm: serverTimestamp(),
      })
      setNovo(VAZIO)
    } catch (err) {
      setErro((err as Error).message || 'Não foi possível criar o jogo.')
    }
  }

  function abrirEdicao(g: Game) {
    if (editando === g.id) return setEditando(null)
    setEditando(g.id)
    setEdit({
      nome: g.nome,
      data: g.data,
      horario: g.horario ?? '',
      local: g.local ?? '',
      localLink: g.localLink ?? '',
      descricao: g.descricao ?? '',
      valor: g.valor,
      custo: g.custoCreditos,
      vagas: g.vagas == null ? '' : String(g.vagas),
    })
  }

  async function salvarEdicao(e: FormEvent, g: Game) {
    e.preventDefault()
    setErro(null)
    try {
      await updateDoc(doc(db, 'games', g.id), dadosDoJogo(edit))
      setEditando(null)
    } catch (err) {
      setErro((err as Error).message || 'Não foi possível salvar as alterações do jogo.')
    }
  }

  async function alternar(g: Game) {
    await updateDoc(doc(db, 'games', g.id), { status: g.status === 'aberto' ? 'encerrado' : 'aberto' })
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

  async function promover(p: Participation) {
    setErro(null)
    try {
      await promoverDaEspera(p)
    } catch {
      setErro('Não foi possível chamar essa pessoa da lista de espera.')
    }
  }

  function exportar(g: Game, lista: Participation[]) {
    baixarCsv(
      `inscritos-${g.nome.replace(/\W+/g, '-').toLowerCase()}-${g.data}.csv`,
      ['Jogador', 'Situação', 'Pagamento', 'Créditos debitados', 'Check-in em', 'Check-in por'],
      lista.map((p) => [
        p.jogadorNome,
        p.status === 'presente' ? 'Presente' : p.status === 'espera' ? 'Lista de espera' : 'Inscrito',
        p.pagoCom === 'creditos' ? 'Créditos' : p.pagoCom === 'dinheiro' ? 'Dinheiro' : '',
        p.creditosDebitados,
        p.presenteEm ? formatarData(paraMillis(p.presenteEm)) : '',
        p.checkInPorNome ?? '',
      ]),
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Jogos</h1>

      <form onSubmit={criar} className="panel mb-8 space-y-3 p-4">
        <h2 className="text-sm font-bold text-ink">Novo jogo</h2>
        <Campos f={novo} set={setNovo} />
        <button type="submit" className="btn-primary">
          Criar jogo
        </button>
      </form>

      {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}

      <div className="space-y-3">
        {games.length === 0 && <p className="text-sm text-mute/70">Nenhum jogo cadastrado.</p>}
        {games.map((g) => {
          const doJogo = parts.filter((p) => p.gameId === g.id && p.status !== 'removida')
          const lista = doJogo.filter((p) => p.status !== 'espera')
          const espera = doJogo
            .filter((p) => p.status === 'espera')
            .sort((a, b) => (paraMillis(a.criadoEm) ?? 0) - (paraMillis(b.criadoEm) ?? 0))
          const expandido = aberto === g.id
          return (
            <div key={g.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{g.nome}</p>
                  <p className="text-xs text-mute">
                    {new Date(g.data + 'T12:00').toLocaleDateString('pt-BR')}
                    {g.horario ? ` às ${g.horario}` : ''} · {reais(g.valor)} / {formatarCreditos(g.custoCreditos)} créditos ·{' '}
                    {lista.length}
                    {g.vagas != null ? `/${g.vagas}` : ''} inscritos ({lista.filter((x) => x.status === 'presente').length} presentes)
                    {espera.length > 0 ? ` · ${espera.length} na espera` : ''} · {g.status === 'aberto' ? 'inscrições abertas' : 'encerrado'}
                  </p>
                  {g.local && <p className="text-xs text-mute/80">{g.local}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => abrirEdicao(g)} className="btn-ghost">
                    {editando === g.id ? 'Cancelar edição' : 'Editar'}
                  </button>
                  <button onClick={() => alternar(g)} className="btn-ghost">
                    {g.status === 'aberto' ? 'Encerrar' : 'Reabrir'}
                  </button>
                  <button onClick={() => setAberto(expandido ? null : g.id)} className="btn-ghost">
                    {expandido ? 'Fechar' : 'Inscritos'}
                  </button>
                </div>
              </div>

              {editando === g.id && (
                <form onSubmit={(e) => salvarEdicao(e, g)} className="mt-4 space-y-3 border-t border-line pt-3">
                  <Campos f={edit} set={setEdit} editando />
                  <p className="text-xs text-mute/70">
                    Quem já se inscreveu mantém o que foi cobrado; o novo valor vale para as próximas inscrições.
                  </p>
                  <button type="submit" className="btn-primary">
                    Salvar alterações
                  </button>
                </form>
              )}

              {expandido && (
                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  {lista.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm text-mute">
                      <span className="text-ink">{p.jogadorNome}</span>
                      <span className="flex items-center gap-3">
                        {p.status === 'ativa'
                          ? 'aguardando check-in'
                          : p.pagoCom === 'creditos'
                            ? `presente · ${formatarCreditos(p.creditosDebitados)} créditos`
                            : 'presente · dinheiro'}
                        {gerenciaInscricoes && (
                          <button onClick={() => remover(p)} className="text-xs text-danger hover:underline">
                            Remover
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                  {lista.length === 0 && <p className="text-xs text-mute/70">Ninguém inscrito ainda.</p>}

                  {espera.length > 0 && (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-warn">Lista de espera</p>
                      {espera.map((p, i) => (
                        <div key={p.id} className="flex items-center justify-between text-sm text-mute">
                          <span className="text-ink">
                            {i + 1}. {p.jogadorNome}
                          </span>
                          <span className="flex items-center gap-3">
                            <button onClick={() => promover(p)} className="text-xs text-accent-hi hover:underline">
                              Chamar para o jogo
                            </button>
                            {gerenciaInscricoes && (
                              <button onClick={() => remover(p)} className="text-xs text-danger hover:underline">
                                Remover
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {gerenciaInscricoes && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <select value={novoUid} onChange={(e) => setNovoUid(e.target.value)} className="input w-auto flex-1">
                        <option value="">Inscrever na hora (com check-in)...</option>
                        {players
                          .filter((p) => !lista.some((x) => x.uid === p.uid))
                          .map((p) => (
                            <option key={p.uid} value={p.uid}>
                              {p.nomeCompleto}
                            </option>
                          ))}
                      </select>
                      <select value={novoModo} onChange={(e) => setNovoModo(e.target.value as 'creditos' | 'dinheiro')} className="input w-auto">
                        <option value="creditos">Check-in debitando créditos</option>
                        <option value="dinheiro">Check-in pago em dinheiro</option>
                      </select>
                      <button disabled={!novoUid} onClick={() => adicionar(g)} className="btn-primary">
                        Adicionar
                      </button>
                    </div>
                  )}

                  <button onClick={() => exportar(g, [...lista, ...espera])} className="btn-ghost mt-2">
                    Exportar inscritos (CSV)
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
