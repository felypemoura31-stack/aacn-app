import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
vi.stubGlobal('window', { location: { origin: 'https://aacn.web.app' } })

import { linkDoJogo, montarListaWhatsapp, ordemDeInscricao } from './listaPresenca'
import type { Game, Participation } from '../types'

const p = (nome: string, criadoEm: unknown, extra: Partial<Participation> = {}) =>
  ({ id: nome, uid: 'u-' + nome, jogadorNome: nome, status: 'ativa', criadoEm, ...extra }) as unknown as Participation

describe('ordem de inscrição', () => {
  it('quem se inscreveu primeiro vem primeiro (não a ordem alfabética)', () => {
    const lista = [p('Ana', 300), p('Zeca', 100), p('Bia', 200)].sort(ordemDeInscricao)
    expect(lista.map((x) => x.jogadorNome)).toEqual(['Zeca', 'Bia', 'Ana'])
  })
  it('inscrição ainda sem hora do servidor vai para o fim', () => {
    const lista = [p('Nova', null), p('Antiga', 10)].sort(ordemDeInscricao)
    expect(lista.map((x) => x.jogadorNome)).toEqual(['Antiga', 'Nova'])
  })
  it('empate de hora desempata pelo nome', () => {
    expect([p('Bia', 5), p('Ana', 5)].sort(ordemDeInscricao).map((x) => x.jogadorNome)).toEqual(['Ana', 'Bia'])
  })
})

describe('lista para o WhatsApp', () => {
  const jogo = { id: 'g 1', nome: 'Jogo', data: '2026-10-12', valor: 15, custoCreditos: 30 } as Game
  it('numera na ordem de inscrição, separa a espera e marca o convidado', () => {
    const texto = montarListaWhatsapp(
      jogo,
      [p('Bia', 2), p('Ana', 1), p('Fila', 3, { status: 'espera' }), p('Visita', 4, { convidado: true, status: 'presente' }), p('Fora', 5, { status: 'removida' })],
      new Map([['u-Ana', 'Alpha']]),
      )
    expect(texto).toContain('1-Ana - Alpha\n2-Bia\n3-Visita - convidado')
    expect(texto).toContain('Lista de espera:\n1-Fila')
    expect(texto).not.toContain('Fora')
    expect(texto).toContain('12/10/2026')
    expect(texto).toContain('https://aacn.web.app/jogos?jogo=g%201')
  })
  it('o link do jogo leva direto ao jogo', () => {
    expect(linkDoJogo(jogo, 'https://aacn.web.app')).toBe('https://aacn.web.app/jogos?jogo=g%201')
  })
})
