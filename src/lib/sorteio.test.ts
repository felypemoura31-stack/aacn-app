import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))

import { PESO_MAX, ajustarPeso, sortearTimes, type JogadorSorteio } from './sorteio'

/** Números "aleatórios" repetíveis, para o teste dar sempre o mesmo resultado. */
function semente(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const jogadores = (pesos: number[]): JogadorSorteio[] => pesos.map((peso, i) => ({ uid: 'u' + i, nome: 'J' + i, peso }))

describe('sorteio de times por peso', () => {
  it('cada jogador cai em exatamente um time e os times diferem em no máximo 1 jogador', () => {
    const js = jogadores([5, 5, 1, 1, 1, 0, 3, 9, 2, 1, 1])
    for (const k of [2, 3, 4]) {
      const times = sortearTimes(js, k, undefined, semente(k))
      expect(times).toHaveLength(k)
      const uids = times.flatMap((t) => t.jogadores.map((j) => j.uid)).sort()
      expect(uids).toEqual(js.map((j) => j.uid).sort())
      const tam = times.map((t) => t.jogadores.length)
      expect(Math.max(...tam) - Math.min(...tam)).toBeLessThanOrEqual(1)
    }
  })

  it('espalha os pesos: a soma dos times fica parecida', () => {
    const js = jogadores([9, 9, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1])
    const totais = sortearTimes(js, 2, undefined, semente(7)).map((t) => t.total)
    expect(Math.abs(totais[0] - totais[1])).toBeLessThanOrEqual(2)
  })

  it('o total do time é a soma dos pesos dos seus jogadores', () => {
    for (const t of sortearTimes(jogadores([5, 3, 1, 1]), 2, undefined, semente(1))) {
      expect(t.total).toBe(t.jogadores.reduce((s, j) => s + j.peso, 0))
    }
  })

  it('recusa menos de 2 times e menos jogadores que times', () => {
    expect(() => sortearTimes(jogadores([1, 1, 1]), 1)).toThrow()
    expect(() => sortearTimes(jogadores([1, 1]), 3)).toThrow()
  })

  it('usa os nomes pedidos e cai nos nomes padrão quando faltam', () => {
    const times = sortearTimes(jogadores([1, 1, 1, 1]), 2, ['Águias', ' '], semente(3))
    expect(times.map((t) => t.nome)).toEqual(['Águias', 'Vermelho'])
  })

  it('ajustarPeso mantém o peso na escala de 0 a 9', () => {
    expect(ajustarPeso(10)).toBe(PESO_MAX)
    expect(ajustarPeso(-3)).toBe(0)
    expect(ajustarPeso(4.6)).toBe(5)
  })
})
