import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth'
import { collection, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { cancelarMinhaInscricao } from './credits'
import { apagar, apagarInscricoesDoJogador, docsDoJogador } from './reset'
import type { Participation, Player } from '../types'

async function timesQueRepresenta(uid: string) {
  return (await getDocs(query(collection(db, 'teams'), where('representanteUid', '==', uid)))).docs
}

/**
 * Admin exclui um jogador: apaga o cadastro e tudo que é só dele (cartão público, contato, carteira,
 * contadores, conquistas, inscrições, pedidos de time). Se era representante, o time fica sem
 * representante. Com `manterFinanceiro`, o extrato de créditos e os pagamentos ficam guardados.
 *
 * A conta de acesso (e-mail/senha) fica no Firebase Authentication, que o app não consegue apagar:
 * se a pessoa entrar de novo, vê que o cadastro foi excluído e pode criar outro.
 */
export async function excluirJogador(uid: string, opcoes: { manterFinanceiro: boolean }): Promise<string[]> {
  const feito: string[] = []

  for (const t of await timesQueRepresenta(uid)) {
    await updateDoc(t.ref, { representanteUid: null, representanteNome: null, representanteEmail: null })
    feito.push(`Time "${t.data().nome}" ficou sem representante.`)
  }

  const inscricoes = await apagarInscricoesDoJogador(uid)
  feito.push(`${inscricoes} inscrição(ões)/presença(s) apagada(s).`)

  const refs = [
    ...(await docsDoJogador('conquistas', uid)),
    ...(await docsDoJogador('teamJoinRequests', uid, 'jogadorUid')),
    ...(opcoes.manterFinanceiro ? [] : [...(await docsDoJogador('ledger', uid)), ...(await docsDoJogador('payments', uid))]),
  ].map((d) => d.ref)
  await apagar(refs)
  if (!opcoes.manterFinanceiro) feito.push('Extrato e pagamentos apagados.')

  // documentos de id = uid; o cadastro é o último, para o jogador não ficar "meio apagado"
  const lote = writeBatch(db)
  for (const col of ['stats', 'wallets', 'contatos', 'cobrancas', 'publicCards', 'players']) lote.delete(doc(db, col, uid))
  await lote.commit()
  feito.push('Cadastro e cartão público excluídos.')
  return feito
}

/**
 * O próprio jogador exclui a conta: confirma a senha, cancela as inscrições que ainda não tiveram
 * check-in, apaga o cadastro (dados pessoais, cartão público e contato) e por fim a conta de acesso.
 * Os registros financeiros (pagamentos e extrato) e de presença em jogos já realizados ficam com a
 * associação. Quem é representante de time precisa pedir ao admin para trocar o representante antes.
 */
export async function excluirMinhaConta(user: User, player: Player, senha: string) {
  if (player.role === 'admin') {
    throw new Error('Administradores não podem excluir a própria conta pelo app (o cargo de admin é definido no console).')
  }
  if (!user.email) throw new Error('Conta sem e-mail; não é possível confirmar a senha.')

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senha))
  } catch {
    throw new Error('Senha incorreta.')
  }

  const times = await timesQueRepresenta(user.uid)
  if (times.length > 0) {
    throw new Error(
      `Você é o representante de ${times.map((t) => t.data().nome).join(', ')}. Peça a um administrador para passar a representação a outra pessoa antes de excluir a conta.`,
    )
  }

  for (const d of await docsDoJogador('participations', user.uid)) {
    const p = { id: d.id, ...d.data() } as Participation
    if (p.pagoCom === 'pendente' && (p.status === 'ativa' || p.status === 'espera')) await cancelarMinhaInscricao(p)
  }

  const lote = writeBatch(db)
  for (const col of ['contatos', 'publicCards', 'players']) lote.delete(doc(db, col, user.uid))
  await lote.commit()

  await deleteUser(user)
}
