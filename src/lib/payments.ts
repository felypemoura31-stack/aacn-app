import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { contar, creditosDoPagamento, descontarMensalidade, formatarCreditos, lancar, lerCarteira, reais, type Autor } from './credits'
import { novoTxid } from './pix'
import { atualizarPagamentoNoCartaoPublico } from './publicCard'
import { calcularNovoVencimento, formatarData, paraMillis } from './status'
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
 * Admin confirma o recebimento (dá a baixa): define o novo vencimento, credita os créditos
 * de jogo (R$ 1 = 2 créditos), registra no extrato e marca a cobrança como
 * confirmada, tudo em um único lote, para nunca creditar duas vezes nem
 * esquecer de creditar. A cobrança guarda quem deu a baixa (a hora vai em confirmadoEm) e como o
 * jogador estava antes, o que permite desfazer a baixa com exatidão no estorno.
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
  const atualPag = paymentSnap.data() as Payment | undefined
  if (!atualPag) throw new Error('Esta cobrança não existe mais (o jogador pode ter cancelado).')
  if (atualPag.status !== 'pendente') throw new Error('Este pagamento já foi confirmado')
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
  contar(batch, payment.uid, { mensalidades: 1 })
  batch.update(doc(db, 'payments', payment.id), {
    status: 'confirmado',
    confirmadoEm: serverTimestamp(),
    dataPagamento,
    creditosGerados,
    confirmadoPor: admin.uid,
    confirmadoPorNome: admin.nome,
    statusAntes: cartao.status,
    vencimentoAntes: cartao.vencimento ?? null,
  })
  await batch.commit()

  await atualizarPagamentoNoCartaoPublico(payment.uid, atualizado.status, vencimento)
}

/** O que o estorno de uma baixa vai mudar; é mostrado antes de confirmar e usado para gravar. */
export interface PlanoDeEstorno {
  /** Vencimento do jogador hoje e como fica depois do estorno (null = sem vencimento). */
  vencimentoAtual: number | null
  vencimentoNovo: number | null
  statusNovo: PlayerStatus
  ultimoPagamentoNovo: number | null
  /** Créditos que a baixa gerou, o que dá para retirar agora (o jogador pode já ter usado parte) e o saldo atual. */
  creditosGerados: number
  creditosRetirados: number
  saldo: number
  carteiraExiste: boolean
}

/**
 * Calcula o estorno de uma baixa. O vencimento volta ao que era antes da baixa; se o jogador teve baixas
 * depois dela (ou a baixa é antiga e não guardou o "antes"), refaz a conta com as baixas que sobraram.
 * Nunca deixa o saldo negativo: retira só o que o jogador ainda tem.
 */
export async function planejarEstorno(payment: Payment): Promise<PlanoDeEstorno> {
  const [pagSnap, cartaoSnap, carteira, doJogador] = await Promise.all([
    getDoc(doc(db, 'payments', payment.id)),
    getDoc(doc(db, 'publicCards', payment.uid)),
    lerCarteira(payment.uid),
    getDocs(query(collection(db, 'payments'), where('uid', '==', payment.uid))),
  ])
  if (!pagSnap.exists() || (pagSnap.data() as Payment).status !== 'confirmado') {
    throw new Error('Esta baixa não está confirmada (talvez já tenha sido estornada).')
  }
  if (!cartaoSnap.exists()) throw new Error('O cadastro deste jogador não existe mais; não há o que estornar.')

  const baixa = { id: pagSnap.id, ...pagSnap.data() } as Payment
  const cartao = cartaoSnap.data() as { status: PlayerStatus; vencimento: number | null }
  const atual = cartao.vencimento ?? null
  const outras = doJogador.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Payment)
    .filter((p) => p.id !== baixa.id && p.status === 'confirmado')
    .sort((a, b) => (paraMillis(a.dataPagamento) ?? 0) - (paraMillis(b.dataPagamento) ?? 0))

  const quando = paraMillis(baixa.confirmadoEm) ?? 0
  const houveBaixaDepois = outras.some((p) => (paraMillis(p.confirmadoEm) ?? 0) > quando)
  let vencimentoNovo: number | null =
    !houveBaixaDepois && baixa.vencimentoAntes !== undefined
      ? baixa.vencimentoAntes
      : outras.reduce<number | null>((v, p) => calcularNovoVencimento(paraMillis(p.dataPagamento) ?? 0, v), null)
  // o estorno só volta no tempo
  if (atual == null) vencimentoNovo = null
  else if (vencimentoNovo != null && vencimentoNovo > atual) vencimentoNovo = atual

  const statusNovo: PlayerStatus =
    cartao.status === 'inativo'
      ? 'inativo'
      : vencimentoNovo != null && vencimentoNovo > Date.now()
        ? cartao.status
        : 'inadimplente'

  const creditosGerados = baixa.creditosGerados ?? creditosDoPagamento(baixa.valor)
  return {
    vencimentoAtual: atual,
    vencimentoNovo,
    statusNovo,
    ultimoPagamentoNovo: outras.length ? (paraMillis(outras[outras.length - 1].dataPagamento) ?? null) : null,
    creditosGerados,
    creditosRetirados: Math.min(creditosGerados, carteira.saldo),
    saldo: carteira.saldo,
    carteiraExiste: carteira.existe,
  }
}

/**
 * Desfaz uma baixa dada indevidamente: a cobrança vira "estornada" (fica no histórico com quem estornou, quando
 * e o motivo), o vencimento volta, os créditos gerados saem da carteira e a mensalidade sai do contador.
 * Tudo no mesmo lote. As conquistas que a mensalidade já tenha rendido não são retiradas (o admin tira em Jogadores).
 */
export async function estornarPagamento(payment: Payment, motivo: string, autor: Autor) {
  const texto = motivo.trim()
  if (texto.length < 3) throw new Error('Explique o motivo do estorno.')
  const plano = await planejarEstorno(payment)

  const batch = writeBatch(db)
  batch.update(doc(db, 'players', payment.uid), {
    status: plano.statusNovo,
    vencimento: plano.vencimentoNovo,
    ultimoPagamento: plano.ultimoPagamentoNovo,
    ultimoEstornoId: payment.id,
    atualizadoEm: serverTimestamp(),
  })
  if (plano.carteiraExiste) {
    const parcial = plano.creditosRetirados < plano.creditosGerados
    lancar(batch, {
      uid: payment.uid,
      saldoAntes: plano.saldo,
      delta: -plano.creditosRetirados,
      tipo: 'estorno_pagamento',
      descricao:
        `Pix de ${reais(payment.valor)} estornado: baixa desfeita pela diretoria` +
        (parcial ? ` (retirados ${formatarCreditos(plano.creditosRetirados)} de ${formatarCreditos(plano.creditosGerados)} créditos; o resto já tinha sido usado)` : ''),
      refId: payment.id,
      autor,
      ledgerId: 'estorno_' + payment.id,
    })
  }
  await descontarMensalidade(batch, payment.uid)
  batch.update(doc(db, 'payments', payment.id), {
    status: 'estornado',
    estornadoEm: serverTimestamp(),
    estornadoPor: autor.uid,
    estornadoPorNome: autor.nome,
    estornoMotivo: texto,
  })
  await batch.commit()

  try {
    await atualizarPagamentoNoCartaoPublico(payment.uid, plano.statusNovo, plano.vencimentoNovo)
  } catch {
    throw new Error('O estorno foi feito, mas não consegui atualizar a carteirinha pública do jogador. Peça para ele abrir o app e tente conferir de novo.')
  }
  return plano
}
