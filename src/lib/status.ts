import type { PlayerStatus } from '../types'

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  pago: 'Adimplente',
  inadimplente: 'Inadimplente',
  inativo: 'Inativo',
}

export const STATUS_COLORS: Record<PlayerStatus, string> = {
  pago: 'bg-ok/15 text-ok border-ok/40',
  inadimplente: 'bg-warn/15 text-warn border-warn/40',
  inativo: 'bg-mute/15 text-mute border-mute/40',
}

export const DIA_MS = 24 * 60 * 60 * 1000
export const CICLO_DIAS = 30

/** Status real: "inativo" é decisão do admin; o resto depende do vencimento. */
export function statusEfetivo(p: {
  status: PlayerStatus
  vencimento: number | null
}): PlayerStatus {
  if (p.status === 'inativo') return 'inativo'
  return p.vencimento != null && p.vencimento > Date.now() ? 'pago' : 'inadimplente'
}

export function isEmDia(status: PlayerStatus) {
  return status === 'pago'
}

export function formatarData(ms: number | null | undefined) {
  return ms ? new Date(ms).toLocaleDateString('pt-BR') : '—'
}

/**
 * Próximo vencimento ao confirmar um pagamento: 30 dias após a data do
 * pagamento. Se o jogador pagou adiantado (ainda em dia), os 30 dias contam a
 * partir do vencimento atual, para não perder dias já pagos.
 */
export function calcularNovoVencimento(
  dataPagamento: number,
  vencimentoAtual: number | null,
) {
  const base =
    vencimentoAtual != null && vencimentoAtual > dataPagamento
      ? vencimentoAtual
      : dataPagamento
  return base + CICLO_DIAS * DIA_MS
}
