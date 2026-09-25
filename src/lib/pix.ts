import type { PixConfig } from '../types'

function campo(id: string, valor: string) {
  return id + String(valor.length).padStart(2, '0') + valor
}

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
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

/** Gera o Pix "copia e cola" (BR Code estático) com valor fixo e txid. */
export function gerarPixCopiaECola(cfg: PixConfig, txid: string) {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', cfg.chave.trim())
  const nome = semAcento(cfg.nome).toUpperCase().slice(0, 25)
  const cidade = semAcento(cfg.cidade).toUpperCase().slice(0, 15)
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
