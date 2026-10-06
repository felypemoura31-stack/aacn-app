import { VERSAO_TERMOS } from './termos'
import type { Player } from '../types'

export function soDigitos(v: string) {
  return v.replace(/\D/g, '')
}

/** Formata como 75680-000 enquanto a pessoa digita. */
export function formatarCep(v: string) {
  const d = soDigitos(v).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function cepValido(v: string | undefined) {
  return soDigitos(v ?? '').length === 8
}

/** Formata como (64) 99999-9999 enquanto a pessoa digita. */
export function formatarTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function telefoneValido(v: string | undefined) {
  const n = soDigitos(v ?? '').length
  return n === 10 || n === 11
}

export function dataNascimentoValida(v: string | undefined) {
  if (!v) return false
  const t = new Date(v + 'T12:00').getTime()
  return !Number.isNaN(t) && t < Date.now() && t > new Date('1900-01-01').getTime()
}

export function idadeEmAnos(iso: string | undefined) {
  if (!dataNascimentoValida(iso)) return null
  const n = new Date(iso + 'T12:00')
  const h = new Date()
  let idade = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) idade--
  return idade
}

export function ehMenor(p: Pick<Player, 'dataNascimento'>) {
  const i = idadeEmAnos(p.dataNascimento)
  return i !== null && i < 18
}

/** Campos obrigatórios que ainda faltam no cadastro (vazio = cadastro completo). */
export function faltasDoCadastro(p: Player): string[] {
  const faltas: string[] = []
  if (!p.nomeCompleto?.trim()) faltas.push('nome completo')
  if (!p.fotoUrl) faltas.push('foto 3x4')
  if (!p.endereco?.trim()) faltas.push('endereço')
  if (!p.bairro?.trim()) faltas.push('bairro')
  if (!cepValido(p.cep)) faltas.push('CEP')
  if (!dataNascimentoValida(p.dataNascimento)) faltas.push('data de nascimento')
  if (!telefoneValido(p.celular)) faltas.push('celular')
  if (!p.contatoEmergenciaNome?.trim()) faltas.push('nome do contato de emergência')
  if (!telefoneValido(p.contatoEmergenciaTelefone)) faltas.push('telefone do contato de emergência')
  if (ehMenor(p)) {
    if (!p.responsavelLegalNome?.trim()) faltas.push('nome do responsável legal (menor de 18 anos)')
    if (!telefoneValido(p.responsavelLegalTelefone)) faltas.push('telefone do responsável legal')
    if (!p.responsavelLegalAutoriza) faltas.push('autorização do responsável legal')
  }
  if (p.aceiteTermosVersao !== VERSAO_TERMOS) faltas.push('aceite do termo de responsabilidade')
  return faltas
}
