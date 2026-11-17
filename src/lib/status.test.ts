import { describe, expect, it } from 'vitest'
import { DIA_MS, calcularNovoVencimento, paraMillis, statusEfetivo } from './status'

describe('vencimento da mensalidade', () => {
  const hoje = Date.now()

  it('quem paga depois de vencido ganha 30 dias a partir do pagamento', () => {
    expect(calcularNovoVencimento(hoje, hoje - 10 * DIA_MS)).toBe(hoje + 30 * DIA_MS)
  })

  it('quem nunca pagou ganha 30 dias a partir do pagamento', () => {
    expect(calcularNovoVencimento(hoje, null)).toBe(hoje + 30 * DIA_MS)
  })

  it('quem paga adiantado não perde os dias já pagos', () => {
    const venc = hoje + 5 * DIA_MS
    expect(calcularNovoVencimento(hoje, venc)).toBe(venc + 30 * DIA_MS)
  })
})

describe('situação efetiva', () => {
  it('inativo continua inativo, mesmo com vencimento no futuro', () => {
    expect(statusEfetivo({ status: 'inativo', vencimento: Date.now() + DIA_MS })).toBe('inativo')
  })
  it('em dia só com vencimento no futuro', () => {
    expect(statusEfetivo({ status: 'pago', vencimento: Date.now() + DIA_MS })).toBe('pago')
    expect(statusEfetivo({ status: 'pago', vencimento: Date.now() - DIA_MS })).toBe('inadimplente')
    expect(statusEfetivo({ status: 'pago', vencimento: null })).toBe('inadimplente')
  })
})

describe('paraMillis', () => {
  it('entende número, Date, Timestamp do Firestore e valor vazio', () => {
    expect(paraMillis(5)).toBe(5)
    expect(paraMillis(new Date(7))).toBe(7)
    expect(paraMillis({ toMillis: () => 9 })).toBe(9)
    expect(paraMillis({ seconds: 2 })).toBe(2000)
    expect(paraMillis(null)).toBeNull()
    expect(paraMillis('x')).toBeNull()
  })
})
