import { deleteField, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
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
 * A foto fica num documento à parte (publicFotos/{uid}): assim as listas de associados, que leem todos os
 * cartões, não baixam a foto de todo mundo. Gravar o cartão por inteiro também tira a foto de cartões antigos.
 */
export async function sincronizarCartaoPublico(player: PublicCardSource) {
  const lote = writeBatch(db)
  lote.set(doc(db, 'publicCards', player.uid), {
    nomeCompleto: player.nomeCompleto,
    temFoto: !!player.fotoUrl,
    timeNome: player.timeAprovado ? player.timeNome : null,
    timeId: player.timeAprovado ? player.timeId : null,
    status: player.status,
    vencimento: player.vencimento ?? null,
    destaques: player.destaques ?? [],
    atualizadoEm: serverTimestamp(),
  })
  if (player.fotoUrl) lote.set(doc(db, 'publicFotos', player.uid), { fotoUrl: player.fotoUrl, atualizadoEm: serverTimestamp() })
  await lote.commit()
}

/** A foto 3x4 pública de um jogador (null se não tiver). */
export async function lerFotoPublica(uid: string) {
  const snap = await getDoc(doc(db, 'publicFotos', uid))
  return snap.exists() ? ((snap.data() as { fotoUrl?: string | null }).fotoUrl ?? null) : null
}

/** O cartão público já com a foto: cartões antigos ainda trazem a foto dentro, os novos a têm em publicFotos. */
export async function lerCartaoPublico<T extends object>(uid: string): Promise<(T & { fotoUrl: string | null }) | null> {
  const snap = await getDoc(doc(db, 'publicCards', uid))
  if (!snap.exists()) return null
  const card = snap.data() as T & { fotoUrl?: string | null; temFoto?: boolean }
  const fotoUrl = card.fotoUrl ?? (card.temFoto === false ? null : await lerFotoPublica(uid))
  return { ...card, fotoUrl }
}

/**
 * Admin: tira a foto de dentro dos cartões antigos e a grava em publicFotos (um cartão por lote, para um cartão
 * fora de sincronia não travar os outros). Cada cartão só precisa disso uma vez.
 * shortcut: migração única, apagar junto com o campo `fotoUrl` dos cartões quando todos estiverem migrados.
 */
export async function migrarFotosDosCartoes(cartoes: { uid: string; fotoUrl?: string | null }[]) {
  for (const c of cartoes) {
    if (!c.fotoUrl) continue
    const lote = writeBatch(db)
    lote.set(doc(db, 'publicFotos', c.uid), { fotoUrl: c.fotoUrl, atualizadoEm: serverTimestamp() })
    lote.update(doc(db, 'publicCards', c.uid), { fotoUrl: deleteField(), temFoto: true, atualizadoEm: serverTimestamp() })
    await lote.commit().catch(() => {})
  }
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
