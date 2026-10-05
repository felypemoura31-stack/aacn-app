import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type {
  Game,
  LedgerTipo,
  PagoCom,
  Participation,
  Player,
  Wallet,
} from '../types'

export const CREDITOS_POR_REAL = 2

export interface Autor {
  uid: string
  nome: string
}

const arredondar = (n: number) => Math.round(n * 100) / 100

export function creditosDoPagamento(valorReais: number) {
  return arredondar(valorReais * CREDITOS_POR_REAL)
}

export function formatarCreditos(n: number) {
  return arredondar(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function reais(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export function participationId(gameId: string, uid: string) {
  return `${gameId}_${uid}`
}

export function novoId() {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function lerCarteira(uid: string) {
  const snap = await getDoc(doc(db, 'wallets', uid))
  return {
    existe: snap.exists(),
    saldo: snap.exists() ? (snap.data() as Wallet).creditos : 0,
    ultimoJogoId: snap.exists() ? (snap.data() as Wallet).ultimoJogoId : null,
  }
}

/** Grava a mudança de saldo e o lançamento no extrato, sempre juntos no mesmo lote. */
export function lancar(
  batch: WriteBatch,
  p: {
    uid: string
    saldoAntes: number
    delta: number
    tipo: LedgerTipo
    descricao: string
    refId: string | null
    autor: Autor
    ledgerId?: string
    ultimoJogoId?: string | null
    existe?: boolean
  },
) {
  const saldoApos = arredondar(p.saldoAntes + p.delta)
  if (saldoApos < 0) throw new Error('O saldo não pode ficar negativo')

  const carteira: Record<string, unknown> = {
    creditos: saldoApos,
    atualizadoEm: serverTimestamp(),
  }
  if (p.ultimoJogoId !== undefined) carteira.ultimoJogoId = p.ultimoJogoId
  if (p.existe === false) {
    batch.set(doc(db, 'wallets', p.uid), { ultimoJogoId: null, ...carteira })
  } else {
    batch.update(doc(db, 'wallets', p.uid), carteira)
  }

  batch.set(doc(db, 'ledger', p.ledgerId ?? novoId()), {
    uid: p.uid,
    tipo: p.tipo,
    creditos: arredondar(p.delta),
    saldoApos,
    descricao: p.descricao,
    refId: p.refId,
    porUid: p.autor.uid,
    porNome: p.autor.nome,
    criadoEm: serverTimestamp(),
  })
}

/** O jogador gasta os próprios créditos. Débito, extrato e inscrição vão no mesmo lote (as regras exigem). */
export async function participarComCreditos(player: Player, game: Game) {
  const { saldo } = await lerCarteira(player.uid)
  if (saldo < game.custoCreditos) throw new Error('Saldo de créditos insuficiente')

  const batch = writeBatch(db)
  lancar(batch, {
    uid: player.uid,
    saldoAntes: saldo,
    delta: -game.custoCreditos,
    tipo: 'jogo',
    descricao: `Inscrição: ${game.nome}`,
    refId: game.id,
    autor: { uid: player.uid, nome: player.nomeCompleto },
    ledgerId: `jogo_${game.id}_${player.uid}`,
    ultimoJogoId: game.id,
  })
  batch.set(doc(db, 'participations', participationId(game.id, player.uid)), {
    gameId: game.id,
    gameNome: game.nome,
    uid: player.uid,
    jogadorNome: player.nomeCompleto,
    pagoCom: 'creditos',
    creditosDebitados: game.custoCreditos,
    status: 'ativa',
    criadoEm: serverTimestamp(),
  })
  await batch.commit()
}

/** Admin inscreve um jogador, debitando créditos ou registrando pagamento em dinheiro. */
export async function adminAdicionarParticipante(
  game: Game,
  jogador: Pick<Player, 'uid' | 'nomeCompleto'>,
  pagoCom: PagoCom,
  admin: Autor,
) {
  const batch = writeBatch(db)
  let debitado = 0
  if (pagoCom === 'creditos') {
    const c = await lerCarteira(jogador.uid)
    if (c.saldo < game.custoCreditos) throw new Error('Saldo de créditos insuficiente')
    debitado = game.custoCreditos
    lancar(batch, {
      uid: jogador.uid,
      saldoAntes: c.saldo,
      delta: -debitado,
      tipo: 'jogo',
      descricao: `Inscrição (feita pela diretoria): ${game.nome}`,
      refId: game.id,
      autor: admin,
      existe: c.existe,
    })
  }
  batch.set(doc(db, 'participations', participationId(game.id, jogador.uid)), {
    gameId: game.id,
    gameNome: game.nome,
    uid: jogador.uid,
    jogadorNome: jogador.nomeCompleto,
    pagoCom,
    creditosDebitados: debitado,
    status: 'ativa',
    criadoEm: serverTimestamp(),
  })
  await batch.commit()
}

/** Admin cancela a inscrição (ela fica no histórico como "removida") e estorna os créditos debitados. */
export async function adminRemoverParticipante(p: Participation, admin: Autor) {
  const batch = writeBatch(db)
  if (p.creditosDebitados > 0) {
    const c = await lerCarteira(p.uid)
    lancar(batch, {
      uid: p.uid,
      saldoAntes: c.saldo,
      delta: p.creditosDebitados,
      tipo: 'estorno',
      descricao: `Estorno: inscrição cancelada em ${p.gameNome}`,
      refId: p.gameId,
      autor: admin,
      existe: c.existe,
    })
  }
  batch.update(doc(db, 'participations', p.id), {
    status: 'removida',
    removidaEm: serverTimestamp(),
  })
  await batch.commit()
}

/** Ajuste manual do admin (positivo ou negativo), sempre com motivo registrado no extrato. */
export async function adminAjustarSaldo(
  jogador: Pick<Player, 'uid' | 'nomeCompleto'>,
  delta: number,
  motivo: string,
  admin: Autor,
) {
  if (!delta) throw new Error('Informe um valor diferente de zero')
  if (!motivo.trim()) throw new Error('Informe o motivo do ajuste')
  const c = await lerCarteira(jogador.uid)
  const batch = writeBatch(db)
  lancar(batch, {
    uid: jogador.uid,
    saldoAntes: c.saldo,
    delta,
    tipo: 'ajuste',
    descricao: motivo.trim(),
    refId: null,
    autor: admin,
    existe: c.existe,
  })
  await batch.commit()
}
