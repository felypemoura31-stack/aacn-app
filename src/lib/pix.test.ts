import { describe, expect, it } from 'vitest'
import { crc16, gerarPixCopiaECola, normalizarChavePix, novoTxid } from './pix'

/** Lê um BR Code (campos "id + tamanho + valor") e confere que os tamanhos fecham certo do começo ao fim. */
function campos(payload: string) {
  const out: Record<string, string> = {}
  let i = 0
  while (i < payload.length) {
    const id = payload.slice(i, i + 2)
    const tam = Number(payload.slice(i + 2, i + 4))
    expect(Number.isInteger(tam)).toBe(true)
    out[id] = payload.slice(i + 4, i + 4 + tam)
    i += 4 + tam
  }
  expect(i).toBe(payload.length)
  return out
}

const cfg = { chave: 'Tesouraria@AACN.com.br', nome: 'Associação de Airsoft Ç', cidade: 'Caldas Novas', valor: 15 }

describe('Pix copia e cola', () => {
  it('CRC16 confere com o vetor de teste conhecido', () => {
    expect(crc16('123456789')).toBe('29B1')
  })

  it('monta um BR Code com tamanhos e CRC corretos', () => {
    const p = gerarPixCopiaECola(cfg, 'AACN123')
    const c = campos(p)
    expect(p.startsWith('000201010211')).toBe(true)
    expect(c['53']).toBe('986')
    expect(c['54']).toBe('15.00')
    expect(c['58']).toBe('BR')
    expect(c['63']).toBe(crc16(p.slice(0, -4)))
    expect(campos(c['26'])['01']).toBe('tesouraria@aacn.com.br')
    expect(campos(c['62'])['05']).toBe('AACN123')
  })

  it('nome e cidade vão sem acento, em maiúsculas e dentro do limite', () => {
    const c = campos(gerarPixCopiaECola({ ...cfg, nome: 'Associação de Airsoft de Caldas Novas Goiás', cidade: 'São Luís de Montes Belos' }, 'X1'))
    expect(c['59']).toBe('ASSOCIACAO DE AIRSOFT DE')
    expect(c['59'].length).toBeLessThanOrEqual(25)
    expect(c['60'].length).toBeLessThanOrEqual(15)
    expect(c['60']).toBe('SAO LUIS DE MON')
  })

  it('o valor sempre sai com duas casas', () => {
    expect(campos(gerarPixCopiaECola({ ...cfg, valor: 7.5 }, 'X'))['54']).toBe('7.50')
  })

  it('normaliza a chave como os bancos esperam', () => {
    expect(normalizarChavePix(' Tesouraria@AACN.com.br ')).toBe('tesouraria@aacn.com.br')
    expect(normalizarChavePix('123.456.789-09')).toBe('12345678909')
    expect(normalizarChavePix('12.345.678/0001-90')).toBe('12345678000190')
    expect(normalizarChavePix('(64) 99999-9999')).toBe('+5564999999999')
    expect(normalizarChavePix('+55 64 99999-9999')).toBe('+5564999999999')
    expect(normalizarChavePix('A1B2C3D4-E5F6-4789-8ABC-0123456789AB')).toBe('a1b2c3d4-e5f6-4789-8abc-0123456789ab')
    expect(normalizarChavePix('\u200Bchave\u00A0pix')).toBe('chavepix')
  })

  it('o identificador da cobrança tem só letras e números e até 25 caracteres', () => {
    const id = novoTxid('uid-com_símbolos-123456789012345')
    expect(id).toMatch(/^[A-Z0-9]{1,25}$/)
  })
})
