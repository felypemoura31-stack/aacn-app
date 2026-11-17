import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))

import { calcularSequencia } from './sequencia'
import { DIA_MS } from './status'

const base = Date.UTC(2026, 0, 10)
/** Pagamentos mensais (a cada 30 dias), `atraso` dias depois do vencimento anterior. */
const mensais = (n: number, atraso = 0) => Array.from({ length: n }, (_, i) => base + i * (30 + atraso) * DIA_MS)

describe('sequência de mensalidades (1 ano de AACN)', () => {
  it('sem pagamento, zero', () => {
    expect(calcularSequencia([])).toBe(0)
  })
  it('12 pagamentos em dia dão 12', () => {
    expect(calcularSequencia(mensais(12))).toBe(12)
  })
  it('pagar adiantado conta', () => {
    expect(calcularSequencia(mensais(4).map((d, i) => d - i * 5 * DIA_MS))).toBe(4)
  })
  it('deixar vencer e pagar depois recomeça de 1', () => {
    const datas = [...mensais(5), base + 5 * 30 * DIA_MS + 20 * DIA_MS]
    expect(calcularSequencia(datas)).toBe(1)
  })
  it('a ordem em que as datas chegam não importa', () => {
    expect(calcularSequencia([...mensais(6)].reverse())).toBe(6)
  })
  it('pagar no último dia do vencimento ainda vale', () => {
    expect(calcularSequencia([base, base + 30 * DIA_MS])).toBe(2)
  })
})
