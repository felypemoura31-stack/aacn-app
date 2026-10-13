import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { ehNoturno, type Autor } from './credits'
import { paraMillis } from './status'
import type { Game, Participation, RankingDoc, RankingJogador, RankingJogo } from '../types'

/**
 * O ranking de presença é UM documento (`ranking/presencas`) que quem lê as presenças (admin, tesoureiro e
 * organizador) monta a partir dos check-ins. Assim cada associado lê só esse documento (uma leitura), em vez de
 * todas as presenças de todo mundo. Só entram jogadores que ainda têm cadastro.
 */
export async function construirRanking(autor: Autor) {
  const [presencas, jogos, cartoes] = await Promise.all([
    getDocs(query(collection(db, 'participations'), where('status', '==', 'presente'))),
    getDocs(collection(db, 'games')),
    getDocs(collection(db, 'publicCards')),
  ])
  const jogoPorId = new Map(jogos.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Game]))
  const cartaoPorUid = new Map(cartoes.docs.map((d) => [d.id, d.data() as { nomeCompleto: string; timeNome?: string | null; timeId?: string | null }]))

  const porJogo = new Map<string, RankingJogo>()
  const jogadores: Record<string, RankingJogador> = {}

  for (const d of presencas.docs) {
    const p = d.data() as Participation
    const g = jogoPorId.get(p.gameId)
    const c = cartaoPorUid.get(p.uid)
    if (!g || !c) continue // jogo apagado ou jogador excluído
    const mes = g.data.slice(0, 7)
    const noturno = ehNoturno(g)

    const j = (jogadores[p.uid] ??= { n: c.nomeCompleto, t: c.timeNome ?? null, ti: c.timeId ?? null, m: {}, nt: {} })
    j.m[mes] = (j.m[mes] ?? 0) + 1
    if (noturno) j.nt[mes] = (j.nt[mes] ?? 0) + 1

    const rj = porJogo.get(g.id) ?? { id: g.id, nome: g.nome, data: g.data, noturno, presentes: 0 }
    rj.presentes++
    porJogo.set(g.id, rj)
  }

  const lista = [...porJogo.values()].sort((a, b) => a.data.localeCompare(b.data))
  const dados: Omit<RankingDoc, 'atualizadoEm'> & { atualizadoEm: unknown } = {
    atualizadoEm: serverTimestamp(),
    atualizadoPor: autor.uid,
    atualizadoPorNome: autor.nome,
    jogos: lista,
    jogadores,
  }
  await setDoc(doc(db, 'ranking', 'presencas'), dados)
}

/** Passou mais de `minutos` desde a última montagem (ou ainda não existe)? */
export function ultrapassou(r: RankingDoc | null, minutos: number) {
  const ms = r ? paraMillis(r.atualizadoEm) : null
  return ms == null || Date.now() - ms > minutos * 60_000
}

/** "tudo", "2026" (um ano) ou "2026-10" (um mês). */
export function noPeriodo(mes: string, periodo: string) {
  if (periodo === 'tudo') return true
  return periodo.length === 4 ? mes.startsWith(periodo) : mes === periodo
}

const somar = (m: Record<string, number>, periodo: string) =>
  Object.entries(m).reduce((s, [mes, n]) => (noPeriodo(mes, periodo) ? s + n : s), 0)

export function periodosDisponiveis(r: RankingDoc | null) {
  const meses = new Set<string>()
  for (const j of Object.values(r?.jogadores ?? {})) for (const mes of Object.keys(j.m)) meses.add(mes)
  for (const g of r?.jogos ?? []) meses.add(g.data.slice(0, 7))
  const lista = [...meses].sort().reverse()
  return { meses: lista, anos: [...new Set(lista.map((m) => m.slice(0, 4)))] }
}

export interface LinhaRanking {
  uid: string
  nome: string
  time: string | null
  timeId: string | null
  jogos: number
  noturnos: number
  /** 1, 2, 2, 4...: quem empata fica na mesma posição. */
  posicao: number
}

/** Jogadores com presença no período, do que mais jogou ao que menos jogou (empate: ordem alfabética). */
export function montarRanking(r: RankingDoc | null, periodo: string, campo: 'jogos' | 'noturnos'): LinhaRanking[] {
  const linhas = Object.entries(r?.jogadores ?? {})
    .map(([uid, j]) => ({ uid, nome: j.n, time: j.t, timeId: j.ti, jogos: somar(j.m, periodo), noturnos: somar(j.nt, periodo), posicao: 0 }))
    .filter((l) => l[campo] > 0)
    .sort((a, b) => b[campo] - a[campo] || a.nome.localeCompare(b.nome, 'pt-BR'))
  linhas.forEach((l, i) => (l.posicao = i > 0 && linhas[i - 1][campo] === l[campo] ? linhas[i - 1].posicao : i + 1))
  return linhas
}

export interface LinhaTime {
  time: string
  jogos: number
  jogadores: number
}

/** Presenças somadas por time (quem está sem time não entra). */
export function ranquearTimes(linhas: LinhaRanking[]): (LinhaTime & { posicao: number })[] {
  const por = new Map<string, LinhaTime>()
  for (const l of linhas) {
    if (!l.time) continue
    const t = por.get(l.time) ?? { time: l.time, jogos: 0, jogadores: 0 }
    t.jogos += l.jogos
    t.jogadores++
    por.set(l.time, t)
  }
  const lista = [...por.values()].sort((a, b) => b.jogos - a.jogos || a.time.localeCompare(b.time, 'pt-BR')).map((t) => ({ ...t, posicao: 0 }))
  lista.forEach((t, i) => (t.posicao = i > 0 && lista[i - 1].jogos === t.jogos ? lista[i - 1].posicao : i + 1))
  return lista
}

export interface Estatisticas {
  jogosRealizados: number
  presencas: number
  mediaPorJogo: number
  jogosNoturnos: number
  jogadores: number
}

export function estatisticas(r: RankingDoc | null, periodo: string): Estatisticas {
  const jogos = (r?.jogos ?? []).filter((g) => noPeriodo(g.data.slice(0, 7), periodo))
  const presencas = jogos.reduce((s, g) => s + g.presentes, 0)
  const jogadores = montarRanking(r, periodo, 'jogos').length
  return {
    jogosRealizados: jogos.length,
    presencas,
    mediaPorJogo: jogos.length ? Math.round((presencas / jogos.length) * 10) / 10 : 0,
    jogosNoturnos: jogos.filter((g) => g.noturno).length,
    jogadores,
  }
}

/** Os jogos do período, do mais recente para o mais antigo. */
export function jogosDoPeriodo(r: RankingDoc | null, periodo: string): RankingJogo[] {
  return (r?.jogos ?? []).filter((g) => noPeriodo(g.data.slice(0, 7), periodo)).sort((a, b) => b.data.localeCompare(a.data))
}
