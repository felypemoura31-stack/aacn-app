import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { creditosDoPagamento } from './credits'
import { novoTxid } from './pix'
import { sincronizarCartaoPublico } from './publicCard'
import { calcularNovoVencimento } from './status'
import type { Payment, PixConfig, Player, Wallet } from '../types'

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

/**
 * Admin confirma o recebimento: define o novo vencimento, credita os créditos
 * de jogo (R$ 1 = 2 créditos) e marca a cobrança como confirmada, tudo em um
 * único lote, para nunca creditar duas vezes nem esquecer de creditar.
 */
export async function confirmarPagamento(payment: Payment, dataPagamento: number) {
  const [playerSnap, walletSnap, paymentSnap] = await Promise.all([
    getDoc(doc(db, 'players', payment.uid)),
    getDoc(doc(db, 'wallets', payment.uid)),
    getDoc(doc(db, 'payments', payment.id)),
  ])
  if (!playerSnap.exists()) throw new Error('Jogador não encontrado')
  if ((paymentSnap.data() as Payment).status === 'confirmado') {
    throw new Error('Este pagamento já foi confirmado')
  }
  const player = playerSnap.data() as Player

  const vencimento = calcularNovoVencimento(dataPagamento, player.vencimento ?? null)
  const atualizado = {
    status: player.status === 'inativo' ? ('inativo' as const) : ('pago' as const),
    vencimento,
    ultimoPagamento: dataPagamento,
  }

  const creditosGerados = creditosDoPagamento(payment.valor)
  const saldoAtual = walletSnap.exists() ? (walletSnap.data() as Wallet).creditos : 0
  const novoSaldo = Math.round((saldoAtual + creditosGerados) * 100) / 100

  const batch = writeBatch(db)
  batch.update(doc(db, 'players', payment.uid), {
    ...atualizado,
    atualizadoEm: serverTimestamp(),
  })
  batch.set(
    doc(db, 'wallets', payment.uid),
    {
      creditos: novoSaldo,
      ultimoJogoId: walletSnap.exists() ? (walletSnap.data() as Wallet).ultimoJogoId : null,
      atualizadoEm: serverTimestamp(),
    },
  )
  batch.update(doc(db, 'payments', payment.id), {
    status: 'confirmado',
    confirmadoEm: serverTimestamp(),
    dataPagamento,
    creditosGerados,
  })
  await batch.commit()

  await sincronizarCartaoPublico({ ...player, ...atualizado })
}
