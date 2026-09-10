import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { enviarEmail } from './mailer'
import { atualizarTimeNoCartaoPublico } from './publicCard'
import type { Player, Team } from '../types'

export async function solicitarEntradaNoTime(player: Player, time: Team) {
  await addDoc(collection(db, 'teamJoinRequests'), {
    timeId: time.id,
    timeNome: time.nome,
    jogadorUid: player.uid,
    jogadorNome: player.nomeCompleto,
    status: 'pendente',
    criadoEm: serverTimestamp(),
    resolvidoEm: null,
  })

  await updateDoc(doc(db, 'players', player.uid), {
    timeId: time.id,
    timeNome: time.nome,
    timeAprovado: false,
    atualizadoEm: serverTimestamp(),
  })

  if (time.representanteEmail) {
    await enviarEmail({
      to: time.representanteEmail,
      subject: `AACN - Novo pedido de entrada no time ${time.nome}`,
      html: `<p>O jogador <strong>${player.nomeCompleto}</strong> solicitou entrar no time <strong>${time.nome}</strong>.</p><p>Acesse o app da AACN, na área "Solicitações do meu time", para aprovar ou recusar.</p>`,
    })
  }
}

export async function aprovarSolicitacao(
  requestId: string,
  jogadorUid: string,
  timeNome: string,
) {
  await updateDoc(doc(db, 'teamJoinRequests', requestId), {
    status: 'aprovado',
    resolvidoEm: serverTimestamp(),
  })
  await updateDoc(doc(db, 'players', jogadorUid), {
    timeAprovado: true,
    atualizadoEm: serverTimestamp(),
  })
  await atualizarTimeNoCartaoPublico(jogadorUid, timeNome)
}

export async function rejeitarSolicitacao(
  requestId: string,
  jogadorUid: string,
) {
  await updateDoc(doc(db, 'teamJoinRequests', requestId), {
    status: 'rejeitado',
    resolvidoEm: serverTimestamp(),
  })
  await updateDoc(doc(db, 'players', jogadorUid), {
    timeId: null,
    timeNome: null,
    timeAprovado: false,
    atualizadoEm: serverTimestamp(),
  })
  await atualizarTimeNoCartaoPublico(jogadorUid, null)
}
