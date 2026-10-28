import { doc, serverTimestamp, type WriteBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { calcularNovoVencimento } from './status'

/** Mensalidades seguidas necessárias para a conquista "1 ano de AACN". */
export const MESES_PARA_UM_ANO = 12

/**
 * Quantas mensalidades seguidas o jogador pagou, contando até a última. Cada pagamento vale um mês; ele só entra na
 * sequência se foi feito até o vencimento deixado pelo anterior (pagar adiantado vale; deixar vencer e pagar depois
 * zera a conta e recomeça de 1). Usa a mesma regra de vencimento da baixa (30 dias a partir do pagamento ou do
 * vencimento atual), então "seguido" aqui é o mesmo que "nunca ficou inadimplente entre um pagamento e outro".
 * `datasDePagamento` são as datas (em ms) das baixas confirmadas e não estornadas, em qualquer ordem.
 */
export function calcularSequencia(datasDePagamento: number[]): number {
  let vencimento: number | null = null
  let seguidas = 0
  for (const data of [...datasDePagamento].sort((a, b) => a - b)) {
    seguidas = vencimento != null && data <= vencimento ? seguidas + 1 : 1
    vencimento = calcularNovoVencimento(data, vencimento)
  }
  return seguidas
}

/**
 * Grava a sequência no documento do jogador (sequencias/{uid}), no mesmo lote da baixa ou do estorno. É esse número
 * que as regras do banco conferem para liberar a conquista "1 ano de AACN" (só a tesouraria grava).
 */
export function gravarSequencia(batch: WriteBatch, uid: string, meses: number) {
  batch.set(doc(db, 'sequencias', uid), { meses, atualizadoEm: serverTimestamp() })
}
