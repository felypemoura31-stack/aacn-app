import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Player } from '../types'

type PublicCardSource = Pick<
  Player,
  'uid' | 'nomeCompleto' | 'fotoUrl' | 'timeId' | 'timeNome' | 'timeAprovado' | 'status' | 'vencimento'
> & { destaques?: string[] }

/**
 * Mantém um espelho público e mínimo dos dados do jogador (sem endereço,
 * contato de emergência ou condições médicas) para que a página de
 * verificação (/verificar/:uid), lida via QR code por parceiros, possa
 * ser acessada sem login. Chamado pelo próprio jogador ou por um admin.
 */
export async function sincronizarCartaoPublico(player: PublicCardSource) {
  await setDoc(doc(db, 'publicCards', player.uid), {
    nomeCompleto: player.nomeCompleto,
    fotoUrl: player.fotoUrl,
    timeNome: player.timeAprovado ? player.timeNome : null,
    timeId: player.timeAprovado ? player.timeId : null,
    status: player.status,
    vencimento: player.vencimento ?? null,
    destaques: player.destaques ?? [],
    atualizadoEm: serverTimestamp(),
  })
}

/**
 * Usado ao confirmar um pagamento (admin ou tesoureiro): só mexe em status e
 * vencimento do cartão público, sem precisar ler os dados pessoais do jogador.
 */
export async function atualizarPagamentoNoCartaoPublico(
  uid: string,
  status: Player['status'],
  vencimento: number | null,
) {
  await updateDoc(doc(db, 'publicCards', uid), {
    status,
    vencimento,
    atualizadoEm: serverTimestamp(),
  })
}

/**
 * Usado pelo representante do time ao aprovar/recusar um jogador: só
 * altera o nome do time exibido, sem tocar no status de pagamento.
 */
export async function atualizarTimeNoCartaoPublico(
  uid: string,
  timeNome: string | null,
  timeId: string | null,
) {
  await updateDoc(doc(db, 'publicCards', uid), {
    timeNome,
    timeId,
    atualizadoEm: serverTimestamp(),
  })
}

/** O jogador escolhe (até 3) as conquistas que aparecem na carteirinha. Vai para o cadastro e para o cartão público. */
export async function salvarDestaques(uid: string, destaques: string[]) {
  await updateDoc(doc(db, 'players', uid), { destaques, atualizadoEm: serverTimestamp() })
  await updateDoc(doc(db, 'publicCards', uid), { destaques, atualizadoEm: serverTimestamp() })
}
