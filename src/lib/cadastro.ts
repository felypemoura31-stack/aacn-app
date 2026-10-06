import type { Player } from '../types'

export function soDigitos(v: string) {
  return v.replace(/\D/g, '')
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

/** Campos obrigatórios que ainda faltam no cadastro (vazio = cadastro completo). */
export function faltasDoCadastro(p: Player): string[] {
  const faltas: string[] = []
  if (!p.nomeCompleto?.trim()) faltas.push('nome completo')
  if (!p.fotoUrl) faltas.push('foto 3x4')
  if (!p.endereco?.trim()) faltas.push('endereço')
  if (!dataNascimentoValida(p.dataNascimento)) faltas.push('data de nascimento')
  if (!telefoneValido(p.celular)) faltas.push('celular')
  if (!p.contatoEmergenciaNome?.trim()) faltas.push('nome do contato de emergência')
  if (!telefoneValido(p.contatoEmergenciaTelefone)) faltas.push('telefone do contato de emergência')
  return faltas
}
