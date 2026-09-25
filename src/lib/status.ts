import type { PlayerStatus } from '../types'

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  pago: 'Pago',
  inadimplente: 'Inadimplente',
  inativo: 'Inativo',
}

export const STATUS_COLORS: Record<PlayerStatus, string> = {
  pago: 'bg-ok/15 text-ok border-ok/40',
  inadimplente: 'bg-warn/15 text-warn border-warn/40',
  inativo: 'bg-mute/15 text-mute border-mute/40',
}

export function isEmDia(status: PlayerStatus) {
  return status === 'pago'
}
