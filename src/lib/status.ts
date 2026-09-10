import type { PlayerStatus } from '../types'

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  pago: 'Pago',
  inadimplente: 'Inadimplente',
  inativo: 'Inativo',
}

export const STATUS_COLORS: Record<PlayerStatus, string> = {
  pago: 'bg-green-100 text-green-800 border-green-300',
  inadimplente: 'bg-amber-100 text-amber-800 border-amber-300',
  inativo: 'bg-gray-200 text-gray-700 border-gray-300',
}

export function isEmDia(status: PlayerStatus) {
  return status === 'pago'
}
