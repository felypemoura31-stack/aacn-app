import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { rotuloDoMes } from '../lib/caixa'
import { ehFinanceiro, temCargo } from '../lib/roles'
import { construirRanking, estatisticas, jogosDoPeriodo, montarRanking, periodosDisponiveis, ranquearTimes, ultrapassou } from '../lib/ranking'
import { formatarData, paraMillis } from '../lib/status'
import type { RankingDoc } from '../types'

const quando = (v: unknown) => {
  const ms = paraMillis(v)
  return ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] uppercase tracking-widest text-mute/80">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-mute">{detalhe}</p>}
    </div>
  )
}

/** Bolinha da posição: ouro, prata e bronze para os três primeiros. */
function Posicao({ n }: { n: number }) {
  const cor = n === 1 ? 'bg-gold text-slate-900' : n === 2 ? 'bg-slate-300 text-slate-900' : n === 3 ? 'bg-amber-700 text-white' : 'bg-surface2 text-mute'
  return <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cor}`}>{n}</span>
}

export function Ranking() {
  const { player } = useAuth()
  const [r, setR] = useState<RankingDoc | null | undefined>(undefined) // undefined = carregando
  const [periodo, setPeriodo] = useState(String(new Date().getFullYear()))
  const [campo, setCampo] = useState<'jogos' | 'noturnos'>('jogos')
  const [verTodos, setVerTodos] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const tentou = useRef(false)

  // quem lê as presenças (diretoria e organização) pode montar o ranking
  const equipe = ehFinanceiro(player) || temCargo(player, 'organizador')

  useEffect(() => {
    return onSnapshot(doc(db, 'ranking', 'presencas'), (s) => setR(s.exists() ? (s.data() as RankingDoc) : null))
  }, [])

  async function atualizar() {
    if (!player) return
    setAtualizando(true)
    setErro(null)
    try {
      await construirRanking({ uid: player.uid, nome: player.nomeCompleto })
    } catch {
      setErro('Não consegui atualizar o ranking agora.')
    } finally {
      setAtualizando(false)
    }
  }

  // ao abrir, a equipe atualiza sozinha se o ranking tem mais de 30 minutos (ou ainda não existe)
  useEffect(() => {
    if (!equipe || !player || r === undefined || tentou.current) return
    tentou.current = true
    if (ultrapassou(r, 30)) atualizar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipe, player, r])

  const { meses, anos } = useMemo(() => periodosDisponiveis(r ?? null), [r])
  // se o período escolhido (começa no ano atual) não tem dados, mostra o ano mais recente que tem
  const periodoEf = periodo === 'tudo' || anos.includes(periodo) || meses.includes(periodo) ? periodo : (anos[0] ?? 'tudo')
  const linhas = useMemo(() => montarRanking(r ?? null, periodoEf, campo), [r, periodoEf, campo])
  const times = useMemo(() => ranquearTimes(montarRanking(r ?? null, periodoEf, 'jogos')), [r, periodoEf])
  const est = useMemo(() => estatisticas(r ?? null, periodoEf), [r, periodoEf])
  const jogos = useMemo(() => jogosDoPeriodo(r ?? null, periodoEf).slice(0, 8), [r, periodoEf])
  const maxPresentes = Math.max(1, ...jogos.map((g) => g.presentes))
  const minha = linhas.find((l) => l.uid === player?.uid)
  const visiveis = verTodos ? linhas : linhas.slice(0, 10)
  const rotuloPeriodo = periodoEf === 'tudo' ? 'todo o período' : periodoEf.length === 4 ? periodoEf : rotuloDoMes(periodoEf)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-ink">Ranking</h1>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <select value={periodoEf} onChange={(e) => setPeriodo(e.target.value)} className="input w-auto" aria-label="Período">
          <option value="tudo">Todo o período</option>
          {anos.map((a) => (
            <option key={a} value={a}>
              Ano {a}
            </option>
          ))}
          {meses.map((m) => (
            <option key={m} value={m}>
              {rotuloDoMes(m)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 text-[11px] text-mute">
          {r && <span>Atualizado em {quando(r.atualizadoEm)}</span>}
          {equipe && (
            <button type="button" disabled={atualizando} onClick={atualizar} className="btn-ghost">
              {atualizando ? 'Atualizando...' : 'Atualizar agora'}
            </button>
          )}
        </div>
      </div>
      {erro && <p className="mb-3 text-sm text-danger">{erro}</p>}

      {r === undefined && <p className="text-sm text-mute">Carregando...</p>}
      {r === null && (
        <p className="rounded-sm border border-line bg-surface px-4 py-6 text-center text-sm text-mute">
          {atualizando ? 'Montando o ranking pela primeira vez...' : 'O ranking ainda não foi montado. Ele aparece depois do primeiro check-in de um jogo.'}
        </p>
      )}

      {r && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi titulo="Jogos realizados" valor={est.jogosRealizados} detalhe={est.jogosNoturnos ? `${est.jogosNoturnos} noturno(s)` : rotuloPeriodo} />
            <Kpi titulo="Presenças" valor={est.presencas} detalhe={`${est.jogadores} jogador(es)`} />
            <Kpi titulo="Média por jogo" valor={est.mediaPorJogo.toLocaleString('pt-BR')} detalhe="presentes em cada jogo" />
            <Kpi titulo="Mais assíduo" valor={linhas[0] ? linhas[0].nome.split(' ')[0] : '—'} detalhe={linhas[0] ? `${linhas[0][campo]} ${campo === 'jogos' ? 'jogo(s)' : 'noturno(s)'}` : 'sem presença no período'} />
          </div>

          {minha && (
            <p className="mb-4 rounded-sm border border-accent-hi/40 bg-accent/10 px-4 py-2 text-sm text-ink">
              Você está em <b>{minha.posicao}º lugar</b> com {minha[campo]} {campo === 'jogos' ? 'jogo(s)' : 'jogo(s) noturno(s)'} ({rotuloPeriodo}).
            </p>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <section className="panel p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-ink">Jogadores</h2>
                <div className="flex gap-1 text-xs">
                  {([['jogos', 'Jogos'], ['noturnos', 'Noturnos']] as const).map(([id, rotulo]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCampo(id)}
                      className={`rounded-full border px-3 py-1 ${campo === id ? 'border-accent-hi bg-accent/15 text-ink' : 'border-line text-mute'}`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              {linhas.length === 0 && <p className="text-sm text-mute/70">Ninguém com presença neste período.</p>}
              <ol className="space-y-1.5">
                {visiveis.map((l) => (
                  <li key={l.uid} className={`flex items-center gap-3 rounded-sm px-2 py-1.5 ${l.uid === player?.uid ? 'bg-accent/10 ring-1 ring-accent-hi/40' : ''}`}>
                    <Posicao n={l.posicao} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{l.nome}</span>
                      <span className="block truncate text-[11px] text-mute">{l.time ?? 'Sem time'}</span>
                    </span>
                    <b className="shrink-0 text-gold">{l[campo]}</b>
                  </li>
                ))}
              </ol>
              {linhas.length > 10 && (
                <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-2 text-xs text-mute underline hover:text-ink">
                  {verTodos ? 'Mostrar só os 10 primeiros' : `Ver todos (${linhas.length})`}
                </button>
              )}
            </section>

            <div className="space-y-6">
              <section className="panel p-4">
                <h2 className="mb-3 text-sm font-bold text-ink">Times</h2>
                {times.length === 0 && <p className="text-sm text-mute/70">Sem presença de times neste período.</p>}
                <ol className="space-y-1.5">
                  {times.map((t) => (
                    <li key={t.time} className="flex items-center gap-3">
                      <Posicao n={t.posicao} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{t.time}</span>
                        <span className="block text-[11px] text-mute">{t.jogadores} jogador(es)</span>
                      </span>
                      <b className="shrink-0 text-gold">{t.jogos}</b>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[10px] text-mute/70">Soma das presenças dos jogadores de cada time (pelo time de hoje).</p>
              </section>

              <section className="panel p-4">
                <h2 className="mb-3 text-sm font-bold text-ink">Presença por jogo</h2>
                {jogos.length === 0 && <p className="text-sm text-mute/70">Nenhum jogo no período.</p>}
                <div className="space-y-1.5">
                  {jogos.map((g) => (
                    <div key={g.id} className="text-xs">
                      <div className="flex justify-between gap-2 text-mute">
                        <span className="truncate">
                          {formatarData(new Date(g.data + 'T12:00').getTime())} · {g.nome}
                          {g.noturno ? ' (noturno)' : ''}
                        </span>
                        <b className="text-ink">{g.presentes}</b>
                      </div>
                      <div className="mt-0.5 h-2 overflow-hidden rounded-sm bg-surface2">
                        <div className="h-full bg-accent-hi" style={{ width: `${(g.presentes / maxPresentes) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
