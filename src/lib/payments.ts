import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { creditosDoPagamento, lancar, lerCarteira, reais, type Autor } from './credits'
import { novoTxid } from './pix'
import { atualizarPagamentoNoCartaoPublico } from './publicCard'
import { calcularNovoVencimento, formatarData } from './status'
import type { Payment, PixConfig, Player, PlayerStatus } from '../types'

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
 * de jogo (R$ 1 = 2 créditos), registra no extrato e marca a cobrança como
 * confirmada, tudo em um único lote, para nunca creditar duas vezes nem
 * esquecer de creditar.
 */
export async function confirmarPagamento(
  payment: Payment,
  dataPagamento: number,
  admin: Autor,
) {
  // Lê só o cartão público (nome/status/vencimento): o tesoureiro não tem acesso aos dados pessoais.
  const [cartaoSnap, carteira, paymentSnap] = await Promise.all([
    getDoc(doc(db, 'publicCards', payment.uid)),
    lerCarteira(payment.uid),
    getDoc(doc(db, 'payments', payment.id)),
  ])
  if (!cartaoSnap.exists()) throw new Error('Jogador não encontrado')
  if ((paymentSnap.data() as Payment).status === 'confirmado') {
    throw new Error('Este pagamento já foi confirmado')
  }
  const cartao = cartaoSnap.data() as { status: PlayerStatus; vencimento: number | null }

  const vencimento = calcularNovoVencimento(dataPagamento, cartao.vencimento ?? null)
  const atualizado = {
    status: cartao.status === 'inativo' ? ('inativo' as const) : ('pago' as const),
    vencimento,
    ultimoPagamento: dataPagamento,
  }
  const creditosGerados = creditosDoPagamento(payment.valor)

  const batch = writeBatch(db)
  batch.update(doc(db, 'players', payment.uid), {
    ...atualizado,
    atualizadoEm: serverTimestamp(),
  })
  lancar(batch, {
    uid: payment.uid,
    saldoAntes: carteira.saldo,
    delta: creditosGerados,
    tipo: 'pagamento',
    descricao: `Pix de ${reais(payment.valor)} (pago em ${formatarData(dataPagamento)})`,
    refId: payment.id,
    autor: admin,
    existe: carteira.existe,
  })
  batch.update(doc(db, 'payments', payment.id), {
    status: 'confirmado',
    confirmadoEm: serverTimestamp(),
    dataPagamento,
    creditosGerados,
  })
  await batch.commit()

  await atualizarPagamentoNoCartaoPublico(payment.uid, atualizado.status, vencimento)
}
