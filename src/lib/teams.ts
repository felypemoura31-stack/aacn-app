import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { Player, Team } from '../types'

export async function solicitarEntradaNoTime(player: Player, time: Team) {
  const lote = writeBatch(db)
  lote.set(doc(collection(db, 'teamJoinRequests')), {
    timeId: time.id,
    timeNome: time.nome,
    jogadorUid: player.uid,
    jogadorNome: player.nomeCompleto,
    status: 'pendente',
    criadoEm: serverTimestamp(),
    resolvidoEm: null,
  })
  lote.update(doc(db, 'players', player.uid), {
    timeId: time.id,
    timeNome: time.nome,
    timeAprovado: false,
    atualizadoEm: serverTimestamp(),
  })
  await lote.commit()
}

export async function aprovarSolicitacao(
  requestId: string,
  jogadorUid: string,
  timeNome: string,
  timeId: string,
) {
  const lote = writeBatch(db)
  lote.update(doc(db, 'teamJoinRequests', requestId), {
    status: 'aprovado',
    resolvidoEm: serverTimestamp(),
  })
  lote.update(doc(db, 'players', jogadorUid), {
    timeAprovado: true,
    atualizadoEm: serverTimestamp(),
  })
  lote.update(doc(db, 'publicCards', jogadorUid), {
    timeNome,
    timeId,
    atualizadoEm: serverTimestamp(),
  })
  await lote.commit()
}

export async function rejeitarSolicitacao(
  requestId: string,
  jogadorUid: string,
) {
  const lote = writeBatch(db)
  lote.update(doc(db, 'teamJoinRequests', requestId), {
    status: 'rejeitado',
    resolvidoEm: serverTimestamp(),
  })
  lote.update(doc(db, 'players', jogadorUid), {
    timeId: null,
    timeNome: null,
    timeAprovado: false,
    atualizadoEm: serverTimestamp(),
  })
  // O cartão público de quem estava pendente já não mostra time; nada a atualizar.
  await lote.commit()
}

/**
 * O representante (ou o admin) tira do time quem já não faz parte. O jogador fica sem time e o cartão
 * público acompanha, no mesmo lote. Os pedidos aprovados dele nesse time passam a "removido", para a
 * aprovação antiga não ser refeita sozinha. Para voltar, o jogador pede de novo e o representante aprova.
 */
export async function removerMembroDoTime(jogadorUid: string, timeId: string) {
  const lote = writeBatch(db)
  lote.update(doc(db, 'players', jogadorUid), {
    timeId: null,
    timeNome: null,
    timeAprovado: false,
    atualizadoEm: serverTimestamp(),
  })
  lote.update(doc(db, 'publicCards', jogadorUid), {
    timeId: null,
    timeNome: null,
    atualizadoEm: serverTimestamp(),
  })
  await lote.commit()

  const pedidos = await getDocs(
    query(
      collection(db, 'teamJoinRequests'),
      where('timeId', '==', timeId),
      where('jogadorUid', '==', jogadorUid),
      where('status', '==', 'aprovado'),
    ),
  )
  for (const p of pedidos.docs) {
    await updateDoc(p.ref, { status: 'removido', resolvidoEm: serverTimestamp() })
  }
}
