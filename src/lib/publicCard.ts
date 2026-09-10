import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Player } from '../types'

type PublicCardSource = Pick<
  Player,
  'uid' | 'nomeCompleto' | 'fotoUrl' | 'timeNome' | 'timeAprovado' | 'status'
>

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
    status: player.status,
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
) {
  await updateDoc(doc(db, 'publicCards', uid), {
    timeNome,
    atualizadoEm: serverTimestamp(),
  })
}
