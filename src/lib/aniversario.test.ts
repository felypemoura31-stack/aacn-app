import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('./credits', () => ({ lerCarteira: vi.fn() }))

import { contaApta, ehAniversarioHoje, hojeEmBrasilia, mensagemDeAniversario, primeiroNome } from './aniversario'

const utc = (a: number, m: number, d: number, h = 12, min = 0) => Date.UTC(a, m - 1, d, h, min)

describe('hoje em Brasília (UTC-3)', () => {
  it('02:59 UTC ainda é o dia anterior; 03:00 UTC já é o dia', () => {
    expect(hojeEmBrasilia(utc(2026, 10, 6, 2, 59))).toEqual({ ano: 2026, mes: 10, dia: 5 })
    expect(hojeEmBrasilia(utc(2026, 10, 6, 3, 0))).toEqual({ ano: 2026, mes: 10, dia: 6 })
  })
  it('na virada do ano usa o ano de Brasília', () => {
    expect(hojeEmBrasilia(utc(2027, 1, 1, 1, 0)).ano).toBe(2026)
  })
})

describe('aniversário', () => {
  it('só no dia e mês da data de nascimento (o ano não importa)', () => {
    expect(ehAniversarioHoje('1990-10-05', utc(2026, 10, 5))).toBe(true)
    expect(ehAniversarioHoje('2005-10-05', utc(2026, 10, 5))).toBe(true)
    expect(ehAniversarioHoje('1990-10-05', utc(2026, 10, 6))).toBe(false)
    expect(ehAniversarioHoje('1990-11-05', utc(2026, 10, 5))).toBe(false)
  })
  it('quem nasceu em 29/02 comemora em 28/02 nos anos sem 29/02', () => {
    expect(ehAniversarioHoje('1992-02-29', utc(2026, 2, 28))).toBe(true)
    expect(ehAniversarioHoje('1992-02-29', utc(2026, 3, 1))).toBe(false)
    expect(ehAniversarioHoje('1992-02-29', utc(2028, 2, 28))).toBe(false)
    expect(ehAniversarioHoje('1992-02-29', utc(2028, 2, 29))).toBe(true)
    expect(ehAniversarioHoje('1992-02-29', utc(2100, 2, 28))).toBe(true) // 2100 não é bissexto
  })
  it('data ausente ou malformada nunca vale', () => {
    expect(ehAniversarioHoje(undefined, utc(2026, 10, 5))).toBe(false)
    expect(ehAniversarioHoje('05/10/1990', utc(2026, 10, 5))).toBe(false)
  })
})

describe('conta apta ao bônus (mais de 30 dias)', () => {
  const agora = utc(2026, 10, 5)
  it('conta nova não ganha; conta antiga ganha', () => {
    expect(contaApta(agora - 5 * 86_400_000, agora)).toBe(false)
    expect(contaApta(agora - 31 * 86_400_000, agora)).toBe(true)
  })
  it('sem data de criação conhecida vale como antiga (igual às regras do banco)', () => {
    expect(contaApta(undefined, agora)).toBe(true)
  })
})

describe('mensagem de parabéns', () => {
  it('usa o primeiro nome e é a mesma para a pessoa no mesmo ano', () => {
    const a = mensagemDeAniversario('Carlos Silva', 'uid1', 2026)
    expect(a).toContain('Carlos')
    expect(mensagemDeAniversario('Carlos Silva', 'uid1', 2026)).toBe(a)
  })
  it('primeiroNome aguenta espaços e nome vazio', () => {
    expect(primeiroNome('  Ana   Souza ')).toBe('Ana')
    expect(primeiroNome('')).toBe('associado')
  })
})
