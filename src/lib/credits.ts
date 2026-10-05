import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Game, PagoCom, Participation, Player, Wallet } from '../types'

export const CREDITOS_POR_REAL = 2

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

async function lerSaldo(uid: string) {
  const snap = await getDoc(doc(db, 'wallets', uid))
  return snap.exists() ? (snap.data() as Wallet).creditos : 0
}

/** O jogador gasta os próprios créditos. Débito e participação vão no mesmo lote (as regras exigem). */
export async function participarComCreditos(player: Player, game: Game) {
  const saldo = await lerSaldo(player.uid)
  if (saldo < game.custoCreditos) throw new Error('Saldo de créditos insuficiente')

  const batch = writeBatch(db)
  batch.update(doc(db, 'wallets', player.uid), {
    creditos: arredondar(saldo - game.custoCreditos),
    ultimoJogoId: game.id,
    atualizadoEm: serverTimestamp(),
  })
  batch.set(doc(db, 'participations', participationId(game.id, player.uid)), {
    gameId: game.id,
    gameNome: game.nome,
    uid: player.uid,
    jogadorNome: player.nomeCompleto,
    pagoCom: 'creditos',
    creditosDebitados: game.custoCreditos,
    criadoEm: serverTimestamp(),
  })
  await batch.commit()
}

/** Admin inscreve um jogador, debitando créditos ou registrando pagamento em dinheiro. */
export async function adminAdicionarParticipante(
  game: Game,
  jogador: Pick<Player, 'uid' | 'nomeCompleto'>,
  pagoCom: PagoCom,
) {
  const batch = writeBatch(db)
  let debitado = 0
  if (pagoCom === 'creditos') {
    const saldo = await lerSaldo(jogador.uid)
    if (saldo < game.custoCreditos) throw new Error('Saldo de créditos insuficiente')
    debitado = game.custoCreditos
    batch.update(doc(db, 'wallets', jogador.uid), {
      creditos: arredondar(saldo - debitado),
      atualizadoEm: serverTimestamp(),
    })
  }
  batch.set(doc(db, 'participations', participationId(game.id, jogador.uid)), {
    gameId: game.id,
    gameNome: game.nome,
    uid: jogador.uid,
    jogadorNome: jogador.nomeCompleto,
    pagoCom,
    creditosDebitados: debitado,
    criadoEm: serverTimestamp(),
  })
  await batch.commit()
}

/** Admin remove a inscrição e devolve os créditos que foram debitados. */
export async function adminRemoverParticipante(p: Participation) {
  const batch = writeBatch(db)
  if (p.creditosDebitados > 0) {
    const saldo = await lerSaldo(p.uid)
    batch.update(doc(db, 'wallets', p.uid), {
      creditos: arredondar(saldo + p.creditosDebitados),
      atualizadoEm: serverTimestamp(),
    })
  }
  batch.delete(doc(db, 'participations', p.id))
  await batch.commit()
}
