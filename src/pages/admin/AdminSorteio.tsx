import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { EtiquetaPeso, SeletorPeso } from '../../components/SeletorPeso'
import { temCargo } from '../../lib/roles'
import {
  NOMES_PADRAO_DOS_TIMES,
  PESO_PADRAO,
  definirPeso,
  linkWhatsappTexto,
  publicarSorteio,
  salvarSorteio,
  sortearTimes,
  textoDoSorteio,
  type TimeSorteado,
} from '../../lib/sorteio'
import { formatarData, paraMillis } from '../../lib/status'
import type { Game, Participation } from '../../types'

interface SorteioSalvo {
  gameId: string
  times: { nome: string; jogadores: { uid: string; nome: string }[] }[]
  publicado: boolean
  criadoPorNome: string
  criadoEm: unknown
  publicadoEm?: unknown
}

const COR_DO_TIME = [
  'border-sky-500/60 bg-sky-500/10 text-sky-300',
  'border-red-500/60 bg-red-500/10 text-red-300',
  'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
  'border-yellow-500/60 bg-yellow-500/10 text-yellow-300',
  'border-orange-500/60 bg-orange-500/10 text-orange-300',
  'border-purple-500/60 bg-purple-500/10 text-purple-300',
  'border-slate-400/60 bg-slate-400/10 text-slate-300',
  'border-zinc-200/60 bg-zinc-200/10 text-zinc-100',
]

/** Admin, tesoureiro e organizador: sorteiam os times dos jogadores presentes, equilibrados pelo peso de cada um. */
export function AdminSorteio() {
  const { player: staff } = useAuth()
  const [params] = useSearchParams()
  const ehAdmin = temCargo(staff, 'admin') // só o admin define os pesos
  const autor = staff ? { uid: staff.uid, nome: staff.nomeCompleto } : null

  const [games, setGames] = useState<Game[]>([])
  const [gameId, setGameId] = useState(params.get('jogo') ?? '')
  const [parts, setParts] = useState<Participation[]>([])
  const [pesos, setPesos] = useState<Record<string, number>>({})
  const [salvo, setSalvo] = useState<SorteioSalvo | null | undefined>(undefined)
  const [quantidade, setQuantidade] = useState(2)
  const [nomes, setNomes] = useState<string[]>(NOMES_PADRAO_DOS_TIMES)
  const [fora, setFora] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('data', 'desc'))
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Game)
      setGames(lista)
      setGameId((atual) => {
        if (atual && lista.some((g) => g.id === atual)) return atual
        // por padrão, o jogo mais próximo de hoje
        const hoje = Date.now()
        const prox = [...lista].sort((a, b) => Math.abs(new Date(a.data + 'T12:00').getTime() - hoje) - Math.abs(new Date(b.data + 'T12:00').getTime() - hoje))[0]
        return prox?.id ?? ''
      })
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'pesos'), (snap) => {
      const m: Record<string, number> = {}
      snap.docs.forEach((d) => (m[d.id] = Number((d.data() as { peso?: number }).peso ?? PESO_PADRAO)))
      setPesos(m)
    })
  }, [])

  useEffect(() => {
    setParts([])
    setSalvo(undefined)
    setFora(new Set())
    if (!gameId) return
    const u1 = onSnapshot(query(collection(db, 'participations'), where('gameId', '==', gameId)), (snap) => setParts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation)))
    const u2 = onSnapshot(doc(db, 'sorteios', gameId), (snap) => setSalvo(snap.exists() ? (snap.data() as SorteioSalvo) : null))
    return () => {
      u1()
      u2()
    }
  }, [gameId])

  // ao abrir um jogo que já foi sorteado, a tela já mostra a quantidade e os nomes daquele sorteio
  useEffect(() => {
    if (!salvo) return
    setQuantidade(salvo.times.length)
    setNomes((atual) => NOMES_PADRAO_DOS_TIMES.map((p, i) => salvo.times[i]?.nome ?? atual[i] ?? p))
  }, [salvo?.criadoEm]) // eslint-disable-line react-hooks/exhaustive-deps

  const game = games.find((g) => g.id === gameId)
  const peso = (uid: string) => pesos[uid] ?? PESO_PADRAO

  const presentes = useMemo(() => parts.filter((p) => p.status === 'presente').sort((a, b) => a.jogadorNome.localeCompare(b.jogadorNome, 'pt-BR')), [parts])
  const incluidos = presentes.filter((p) => !fora.has(p.uid))
  const somaPesos = incluidos.reduce((s, p) => s + peso(p.uid), 0)

  // o que aparece é sempre o sorteio gravado; os pesos entram só agora, na tela (o documento não os guarda)
  const resultado: TimeSorteado[] | null = useMemo(
    () =>
      salvo
        ? salvo.times.map((t) => {
            const jogadores = t.jogadores.map((j) => ({ ...j, peso: pesos[j.uid] ?? PESO_PADRAO })).sort((a, b) => b.peso - a.peso || a.nome.localeCompare(b.nome, 'pt-BR'))
            return { nome: t.nome, jogadores, total: jogadores.reduce((s, j) => s + j.peso, 0) }
          })
        : null,
    [salvo, pesos],
  )
  const totais = resultado?.map((t) => t.total) ?? []
  const diferenca = totais.length ? Math.max(...totais) - Math.min(...totais) : 0

  async function sortear() {
    if (!game || !autor) return
    setErro(null)
    if (incluidos.length < quantidade) return setErro(`Há só ${incluidos.length} jogador(es) no sorteio para ${quantidade} times.`)
    if (salvo?.publicado && !window.confirm('Este sorteio já foi publicado aos jogadores. Sortear de novo tira o resultado atual da vista deles até você publicar o novo. Continuar?')) return
    setOcupado(true)
    try {
      const times = sortearTimes(
        incluidos.map((p) => ({ uid: p.uid, nome: p.jogadorNome, peso: peso(p.uid) })),
        quantidade,
        nomes.slice(0, quantidade),
      )
      await salvarSorteio(game, times, autor)
    } catch (e) {
      setErro((e as Error).message || 'Não consegui sortear. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  async function alternarPublicacao() {
    if (!game || !autor || !salvo) return
    setOcupado(true)
    setErro(null)
    try {
      await publicarSorteio(game, !salvo.publicado, autor)
    } catch {
      setErro('Não consegui mudar a publicação. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  async function mudarPeso(uid: string, nome: string, novo: number) {
    if (!autor) return
    setErro(null)
    try {
      await definirPeso({ uid, nome }, peso(uid), novo, autor)
    } catch {
      setErro('Só o admin pode definir o peso.')
    }
  }

  function alternarJogador(uid: string) {
    setFora((f) => {
      const n = new Set(f)
      if (n.has(uid)) n.delete(uid)
      else n.add(uid)
      return n
    })
  }

  const texto = game && resultado ? textoDoSorteio(game, resultado) : ''
  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Sorteio de times</h1>
      <p className="mb-5 max-w-2xl text-sm text-mute">
        Sorteia os jogadores <b className="text-ink">presentes</b> (com check-in) em times equilibrados pelo <b className="text-ink">peso</b> de cada um: novato 1, veterano 5. O sorteio espalha os pesos
        para a soma ficar parecida em todos os times e o número de jogadores diferir no máximo em 1. {ehAdmin ? 'Você define os pesos aqui ou em Pesos do sorteio.' : 'Só o admin define os pesos.'}
      </p>

      <label className="mb-4 block text-sm text-mute">
        Jogo
        <select value={gameId} onChange={(e) => setGameId(e.target.value)} className="input mt-1">
          {games.length === 0 && <option value="">Nenhum jogo cadastrado</option>}
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {new Date(g.data + 'T12:00').toLocaleDateString('pt-BR')} · {g.nome}
            </option>
          ))}
        </select>
      </label>

      {erro && <p className="mb-4 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="panel p-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">Presentes ({presentes.length})</h2>
            <p className="text-[11px] text-mute">
              No sorteio: <b className="text-ink">{incluidos.length}</b> · soma dos pesos: <b className="text-gold">{somaPesos}</b>
            </p>
          </div>
          {presentes.length === 0 && (
            <p className="text-sm text-mute/70">
              Ninguém fez check-in neste jogo ainda. Faça o check-in dos jogadores na tela inicial ou em{' '}
              <Link to="/admin/checkin" className="text-accent-hi underline">
                Check-in
              </Link>
              .
            </p>
          )}
          <ul className="space-y-1">
            {presentes.map((p) => (
              <li key={p.uid} className="flex items-center gap-2 rounded-sm border border-line bg-surface2 px-2 py-1.5">
                <input type="checkbox" checked={!fora.has(p.uid)} onChange={() => alternarJogador(p.uid)} aria-label={`Incluir ${p.jogadorNome} no sorteio`} />
                <span className={`min-w-0 flex-1 truncate text-sm ${fora.has(p.uid) ? 'text-mute line-through' : 'text-ink'}`}>{p.jogadorNome}</span>
                {ehAdmin ? <SeletorPeso valor={peso(p.uid)} aoMudar={(n) => mudarPeso(p.uid, p.jogadorNome, n)} /> : <EtiquetaPeso peso={peso(p.uid)} />}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-mute/70">Desmarque quem não entra no sorteio (árbitro, convidado que vai ficar de fora...).</p>
        </section>

        <section className="space-y-4">
          <div className="panel p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">Times</h2>
            <label className="mb-3 block text-xs text-mute">
              Quantos times
              <select value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className="input mt-1 w-auto">
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} times
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: quantidade }, (_, i) => (
                <input
                  key={i}
                  value={nomes[i] ?? ''}
                  maxLength={30}
                  onChange={(e) => setNomes((n) => n.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Time ${i + 1}`}
                  className="input"
                  aria-label={`Nome do time ${i + 1}`}
                />
              ))}
            </div>
            <button type="button" onClick={sortear} disabled={ocupado || !game || incluidos.length < quantidade} className="btn-primary mt-4 w-full">
              {ocupado ? 'Sorteando...' : resultado ? 'Sortear de novo' : 'Sortear times'}
            </button>
            {incluidos.length < quantidade && presentes.length > 0 && <p className="mt-2 text-xs text-warn">Precisa de pelo menos {quantidade} jogadores no sorteio.</p>}
          </div>
        </section>
      </div>

      {resultado && game && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-ink">Resultado</h2>
              <p className="text-[11px] text-mute">
                Sorteado por {salvo?.criadoPorNome}
                {paraMillis(salvo?.criadoEm) ? ` em ${formatarData(paraMillis(salvo?.criadoEm))} às ${new Date(paraMillis(salvo?.criadoEm)!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''} · diferença
                entre o time mais forte e o mais fraco: <b className="text-ink">{diferenca} ponto(s)</b>
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${salvo?.publicado ? 'border-ok/40 bg-ok/15 text-ok' : 'border-warn/40 bg-warn/15 text-warn'}`}>
              {salvo?.publicado ? 'Publicado aos jogadores' : 'Só a diretoria vê (rascunho)'}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resultado.map((t, i) => (
              <div key={i} className={`rounded-sm border p-3 ${COR_DO_TIME[i % COR_DO_TIME.length]}`}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider">{t.nome}</h3>
                  <p className="text-[11px] opacity-90">
                    {t.jogadores.length} jogadores · peso {t.total}
                  </p>
                </div>
                <ul className="space-y-0.5 text-sm text-ink">
                  {t.jogadores.map((j) => (
                    <li key={j.uid} className="flex items-center justify-between gap-2">
                      <span className="truncate">{j.nome}</span>
                      <span className="shrink-0 text-[11px] text-mute">{j.peso}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={alternarPublicacao} disabled={ocupado} className={salvo?.publicado ? 'btn-ghost' : 'btn-primary'}>
              {salvo?.publicado ? 'Retirar da vista dos jogadores' : 'Publicar aos jogadores'}
            </button>
            <button type="button" onClick={copiar} className="btn-ghost">
              {copiado ? 'Copiado!' : 'Copiar texto'}
            </button>
            <a href={linkWhatsappTexto(texto)} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              Enviar no WhatsApp
            </a>
          </div>
          <p className="mt-2 text-[11px] text-mute/70">Os jogadores veem só os nomes dos times e de quem está em cada um (em Jogos), nunca os pesos.</p>
        </section>
      )}
    </div>
  )
}
