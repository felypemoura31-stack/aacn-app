import type { UserRole } from '../types'

export interface CargoInfo {
  value: UserRole
  label: string
  descricao: string
}

/**
 * Cargos que o admin pode delegar pelo app. O cargo "admin" NÃO entra aqui de
 * propósito: ele só é definido direto no console do Firebase (campo `role`).
 * Para criar um cargo novo: adicione o valor em `UserRole` (types.ts), uma
 * linha aqui e as permissões dele em `firestore.rules`.
 */
export const CARGOS_DELEGAVEIS: CargoInfo[] = [
  {
    value: 'tesoureiro',
    label: 'Tesoureiro',
    descricao: 'Pagamentos, jogos e créditos',
  },
]

export function rotuloDoCargo(role: UserRole) {
  if (role === 'admin') return 'Administrador'
  if (role === 'player') return 'Jogador'
  return CARGOS_DELEGAVEIS.find((c) => c.value === role)?.label ?? role
}
