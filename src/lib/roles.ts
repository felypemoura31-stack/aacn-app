import type { Player, UserRole } from '../types'

export interface CargoInfo {
  value: UserRole
  label: string
  descricao: string
}

/**
 * Cargos que o admin pode delegar pelo app. O cargo "admin" NÃO entra aqui de
 * propósito: ele só é definido direto no console do Firebase (campo `role`).
 * Uma pessoa pode ter vários cargos delegados ao mesmo tempo (ficam em `cargos`).
 * Para criar um cargo novo: adicione o valor em `UserRole` (types.ts), uma
 * linha aqui e as permissões dele em `firestore.rules` (função `temCargo`).
 */
export const CARGOS_DELEGAVEIS: CargoInfo[] = [
  {
    value: 'tesoureiro',
    label: 'Tesoureiro',
    descricao: 'Pagamentos, jogos e créditos',
  },
  {
    value: 'organizador',
    label: 'Organizador',
    descricao: 'Cria jogos, define os valores e faz o check-in por QR no dia (debita créditos e marca presença)',
  },
  {
    value: 'parceiro',
    label: 'Parceiro (lojista)',
    descricao: 'Gerencia a própria loja na aba Parceiros (promoções, descontos e dados) e ganha uma conquista exclusiva',
  },
]

/** Todos os cargos de uma pessoa: o principal (admin ou, em cadastros antigos, um delegado) mais os delegados. */
export function cargosDe(p: Pick<Player, 'role' | 'cargos'> | null | undefined): UserRole[] {
  if (!p) return []
  const lista = new Set<UserRole>()
  if (p.role && p.role !== 'player') lista.add(p.role)
  for (const c of p.cargos ?? []) lista.add(c)
  return [...lista]
}

export function temCargo(p: Pick<Player, 'role' | 'cargos'> | null | undefined, cargo: UserRole) {
  return cargosDe(p).includes(cargo)
}

/** Admin ou tesoureiro (mesmo critério das regras do banco). */
export const ehFinanceiro = (p: Pick<Player, 'role' | 'cargos'> | null | undefined) => temCargo(p, 'admin') || temCargo(p, 'tesoureiro')

export function rotuloDoCargo(role: UserRole) {
  if (role === 'admin') return 'Administrador'
  if (role === 'player') return 'Jogador'
  return CARGOS_DELEGAVEIS.find((c) => c.value === role)?.label ?? role
}

/** "Organizador, Parceiro (lojista)" ou "Jogador". */
export function rotulosDosCargos(p: Pick<Player, 'role' | 'cargos'> | null | undefined) {
  const lista = cargosDe(p)
  return lista.length ? lista.map(rotuloDoCargo).join(', ') : 'Jogador'
}
