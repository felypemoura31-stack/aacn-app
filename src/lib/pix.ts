import type { PixConfig } from '../types'

function campo(id: string, valor: string) {
  return id + String(valor.length).padStart(2, '0') + valor
}

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Nome e cidade do recebedor no BR Code: sem acento, maiúsculas, só letras/números/espaço, sem sobrar espaço no corte. */
function textoDoCodigo(s: string, max: number) {
  return semAcento(s)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}

function crc16(payload: string) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Deixa a chave Pix do jeito que os bancos esperam, mesmo que tenha sido digitada ou colada com sobras:
 * e-mail em minúsculas e sem espaços; chave aleatória em minúsculas; CPF/CNPJ só com os números;
 * telefone no formato +55DDDNÚMERO.
 */
export function normalizarChavePix(chave: string) {
  // espaços "invisíveis" (colar do WhatsApp ou de e-mail traz caracteres que o banco não reconhece)
  const c = chave.replace(/[​-‏‪-‮⁠﻿ ]/g, ' ').trim()
  if (c.includes('@')) return c.replace(/\s+/g, '').toLowerCase()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase()
  const digitos = c.replace(/\D/g, '')
  if (/^[\d\s().+/-]+$/.test(c)) {
    if (c.startsWith('+')) return '+' + digitos
    // "(64) 99999-9999" é telefone; "000.000.000-00" e "00.000.000/0000-00" são CPF/CNPJ
    if (c.includes('(')) return '+55' + (digitos.length >= 12 && digitos.startsWith('55') ? digitos.slice(2) : digitos)
    return digitos
  }
  return c.replace(/\s+/g, '')
}

/** Que tipo de chave o app entendeu (para o admin conferir). */
export function tipoDaChavePix(chave: string) {
  const c = normalizarChavePix(chave)
  if (!c) return null
  if (c.includes('@')) return 'e-mail'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(c)) return 'chave aleatória'
  if (c.startsWith('+')) return 'telefone'
  if (/^\d{14}$/.test(c)) return 'CNPJ'
  if (/^\d{11}$/.test(c)) return 'CPF ou telefone'
  return 'chave'
}

/** Gera o Pix "copia e cola" (BR Code estático) com valor fixo e txid. */
export function gerarPixCopiaECola(cfg: PixConfig, txid: string) {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', normalizarChavePix(cfg.chave))
  const nome = textoDoCodigo(cfg.nome, 25)
  const cidade = textoDoCodigo(cfg.cidade, 15)
  const id = txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'

  const semCrc =
    campo('00', '01') +
    campo('01', '11') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', cfg.valor.toFixed(2)) +
    campo('58', 'BR') +
    campo('59', nome) +
    campo('60', cidade) +
    campo('62', campo('05', id)) +
    '6304'

  return semCrc + crc16(semCrc)
}

export function novoTxid(uid: string) {
  const u = uid.replace(/[^A-Za-z0-9]/g, '').slice(0, 10)
  return ('AACN' + u + Date.now().toString(36)).toUpperCase().slice(0, 25)
}
