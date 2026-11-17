import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('./credits', () => ({ ehNoturno: () => false }))

import { estatisticas, montarRanking, noPeriodo, ranquearTimes } from './ranking'
import type { RankingDoc } from '../types'

const doc = {
  jogos: [
    { id: 'g1', nome: 'A', data: '2026-09-10', noturno: false, presentes: 2 },
    { id: 'g2', nome: 'B', data: '2026-10-10', noturno: true, presentes: 3 },
  ],
  jogadores: {
    u1: { n: 'Zeca', t: 'Alpha', ti: 'a', m: { '2026-09': 1, '2026-10': 1 }, nt: { '2026-10': 1 } },
    u2: { n: 'Ana', t: 'Alpha', ti: 'a', m: { '2026-10': 2 }, nt: {} },
    u3: { n: 'Bia', t: null, ti: null, m: { '2026-10': 2 }, nt: {} },
  },
} as unknown as RankingDoc

describe('ranking de presença', () => {
  it('ordena por jogos, empata pelo nome e repete a posição do empate', () => {
    const linhas = montarRanking(doc, 'tudo', 'jogos')
    expect(linhas.map((l) => [l.nome, l.jogos, l.posicao])).toEqual([
      ['Ana', 2, 1],
      ['Bia', 2, 1],
      ['Zeca', 2, 1],
    ])
  })
  it('filtra por mês e por ano; quem não jogou no período some', () => {
    expect(montarRanking(doc, '2026-09', 'jogos').map((l) => l.nome)).toEqual(['Zeca'])
    expect(noPeriodo('2026-10', '2026')).toBe(true)
    expect(noPeriodo('2026-10', '2025')).toBe(false)
    expect(noPeriodo('2026-10', '2026-10')).toBe(true)
  })
  it('somas por time ignoram quem não tem time', () => {
    const times = ranquearTimes(montarRanking(doc, 'tudo', 'jogos'))
    expect(times).toEqual([{ time: 'Alpha', jogos: 4, jogadores: 2, posicao: 1 }])
  })
  it('estatísticas do período', () => {
    expect(estatisticas(doc, '2026-10')).toMatchObject({ jogosRealizados: 1, presencas: 3, jogosNoturnos: 1, mediaPorJogo: 3 })
    expect(estatisticas(null, 'tudo').jogosRealizados).toBe(0)
  })
})
