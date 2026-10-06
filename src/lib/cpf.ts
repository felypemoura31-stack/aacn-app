import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

/** CPF já usado por outra conta (as regras do banco recusam o documento duplicado do CPF). */
export class CpfEmUsoError extends Error {
  code = 'cpf-em-uso'
  constructor() {
    super('Este CPF já está cadastrado em outra conta.')
  }
}

export function ehNegadoPeloBanco(e: unknown) {
  return (e as { code?: string })?.code === 'permission-denied'
}

/**
 * Troca o CPF de um cadastro garantindo que é único: no mesmo lote vão o cadastro, o documento do CPF
 * novo (que não pode já existir) e a baixa do documento do CPF antigo. Quem chama: o próprio jogador
 * (Meus dados) ou o admin (ficha do jogador). `novo` vazio apaga o CPF (só o admin).
 */
export async function trocarCpf(uid: string, antigo: string, novo: string) {
  if (antigo === novo) return
  const lote = writeBatch(db)
  lote.update(doc(db, 'players', uid), { cpf: novo, atualizadoEm: serverTimestamp() })
  if (novo) lote.set(doc(db, 'cpfs', novo), { uid, criadoEm: serverTimestamp() })
  if (antigo) lote.delete(doc(db, 'cpfs', antigo))
  try {
    await lote.commit()
  } catch (e) {
    if (ehNegadoPeloBanco(e) && novo) throw new CpfEmUsoError()
    throw e
  }
}
