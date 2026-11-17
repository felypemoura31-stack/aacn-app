import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))

import { CAT_JOGOS_DINHEIRO, CAT_MENSALIDADES, lerValor, movimentosAutomaticos, resumir, saldoAte } from './caixa'
import type { Game, Participation, Payment } from '../types'

describe('lerValor (valor digitado no caixa)', () => {
  it.each([
    ['12,50', 12.5],
    ['1.250,00', 1250],
    ['1.250', 1250], // mil duzentos e cinquenta, como se escreve no Brasil
    ['12.500', 12500],
    ['1.234.567', 1234567],
    ['12.5', 12.5],
    ['1234.56', 1234.56],
    ['0,5', 0.5],
    ['R$ 30', 30],
  ])('%s vira %d', (texto, esperado) => {
    expect(lerValor(texto)).toBe(esperado)
  })

  it.each(['', 'abc', '0', '0,00', '-5', '1.2.3'])('%s não é um valor', (texto) => {
    expect(lerValor(texto)).toBeNull()
  })
})

const jogo = { id: 'g1', nome: 'Jogo', data: '2026-10-12', valor: 15 } as Game
const presenca = (extra: Partial<Participation>) => ({ gameId: 'g1', status: 'presente', pagoCom: 'dinheiro', ...extra }) as Participation

describe('entradas automáticas do caixa', () => {
  it('dinheiro dos jogos usa o valor pago na hora, não o preço atual do jogo', () => {
    const [m] = movimentosAutomaticos([], [presenca({ valorPago: 10 })], [jogo])
    expect(m).toMatchObject({ valor: 10, categoria: CAT_JOGOS_DINHEIRO, data: '2026-10-12' })
  })
  it('inscrição antiga, sem valorPago, vale o preço do jogo', () => {
    expect(movimentosAutomaticos([], [presenca({})], [jogo])[0].valor).toBe(15)
  })
  it('só presença paga em dinheiro entra (crédito e inscrição sem check-in não)', () => {
    const lista = [presenca({ pagoCom: 'creditos' }), presenca({ status: 'ativa' }), presenca({ gameId: 'outro' })]
    expect(movimentosAutomaticos([], lista, [jogo])).toHaveLength(0)
  })
  it('mensalidade conta confirmada, não a estornada nem a pendente', () => {
    const pag = (status: string) => ({ status, valor: 20, dataPagamento: Date.UTC(2026, 9, 5, 15) }) as Payment
    const movs = movimentosAutomaticos([pag('confirmado'), pag('estornado'), pag('pendente')], [], [])
    expect(movs).toHaveLength(1)
    expect(movs[0]).toMatchObject({ valor: 20, categoria: CAT_MENSALIDADES })
  })
})

describe('totais do caixa', () => {
  const movs = [
    { tipo: 'entrada' as const, valor: 0.1, data: '2026-10-01', categoria: 'A' },
    { tipo: 'entrada' as const, valor: 0.2, data: '2026-10-02', categoria: 'A' },
    { tipo: 'saida' as const, valor: 0.05, data: '2026-10-03', categoria: 'B' },
    { tipo: 'entrada' as const, valor: 100, data: '2026-11-01', categoria: 'A' },
  ]
  it('soma em centavos, sem erro de ponto flutuante', () => {
    const r = resumir(movs, '2026-10')
    expect(r.entradas).toBe(0.3)
    expect(r.saidas).toBe(0.05)
    expect(r.saldoMes).toBe(0.25)
    expect(r.entradasPorCategoria).toEqual({ A: 0.3 })
  })
  it('o saldo acumulado vai até o fim do mês pedido', () => {
    expect(saldoAte(movs, '2026-10')).toBe(0.25)
    expect(saldoAte(movs, '2026-11')).toBe(100.25)
    expect(saldoAte(movs, 'todos')).toBe(100.25)
  })
})
