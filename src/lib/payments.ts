import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { novoTxid } from './pix'
import { sincronizarCartaoPublico } from './publicCard'
import { calcularNovoVencimento } from './status'
import type { Payment, PixConfig, Player } from '../types'

export async function gerarCobranca(player: Player, cfg: PixConfig) {
  await addDoc(collection(db, 'payments'), {
    uid: player.uid,
    jogadorNome: player.nomeCompleto,
    valor: cfg.valor,
    txid: novoTxid(player.uid),
    status: 'pendente',
    criadoEm: serverTimestamp(),
    confirmadoEm: null,
    dataPagamento: null,
  })
}

/** Admin confirma o recebimento: define o novo vencimento e sincroniza o cartão público. */
export async function confirmarPagamento(payment: Payment, dataPagamento: number) {
  const snap = await getDoc(doc(db, 'players', payment.uid))
  if (!snap.exists()) throw new Error('Jogador não encontrado')
  const player = snap.data() as Player

  const vencimento = calcularNovoVencimento(dataPagamento, player.vencimento ?? null)
  const atualizado = {
    status: player.status === 'inativo' ? ('inativo' as const) : ('pago' as const),
    vencimento,
    ultimoPagamento: dataPagamento,
  }

  await updateDoc(doc(db, 'players', payment.uid), {
    ...atualizado,
    atualizadoEm: serverTimestamp(),
  })
  await sincronizarCartaoPublico({ ...player, ...atualizado })
  await updateDoc(doc(db, 'payments', payment.id), {
    status: 'confirmado',
    confirmadoEm: serverTimestamp(),
    dataPagamento,
  })
}
