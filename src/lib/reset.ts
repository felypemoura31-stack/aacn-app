import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Participation, Player } from '../types'

export interface OpcoesReset {
  extrato: boolean
  conquistas: boolean
  jogos: boolean
  mensalidades: boolean
}

export const ROTULOS_RESET: { id: keyof OpcoesReset; titulo: string; detalhe: string }[] = [
  {
    id: 'extrato',
    titulo: 'Extrato e saldo de créditos',
    detalhe: 'Apaga todos os lançamentos do extrato (inclusive bônus) e zera o saldo.',
  },
  {
    id: 'conquistas',
    titulo: 'Conquistas (selos)',
    detalhe:
      'Apaga os selos resgatados. Se as metas ainda forem atingidas, o jogador resgata de novo (e recebe o bônus de novo) ao abrir o app.',
  },
  {
    id: 'jogos',
    titulo: 'Inscrições e presenças em jogos',
    detalhe: 'Apaga as inscrições/check-ins, ajusta as vagas dos jogos e zera os contadores de jogos e jogos noturnos.',
  },
  {
    id: 'mensalidades',
    titulo: 'Pagamentos e mensalidade',
    detalhe: 'Apaga os pagamentos Pix, volta a situação para inadimplente (sem vencimento) e zera o contador de mensalidades.',
  },
]

/** Apaga em lotes (o Firestore aceita até 500 operações por lote). */
export async function apagar(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    refs.slice(i, i + 400).forEach((r) => batch.delete(r))
    await batch.commit()
  }
}

export const docsDoJogador = async (colecao: string, uid: string, campo = 'uid') =>
  (await getDocs(query(collection(db, colecao), where(campo, '==', uid)))).docs

/** Apaga as inscrições/presenças do jogador e devolve as vagas dos jogos (contadores). Retorna quantas eram. */
export async function apagarInscricoesDoJogador(uid: string) {
  const inscricoes = await docsDoJogador('participations', uid)
  const ajustes = new Map<string, { inscritos: number; espera: number }>()
  for (const d of inscricoes) {
    const p = d.data() as Participation
    const a = ajustes.get(p.gameId) ?? { inscritos: 0, espera: 0 }
    if (p.status === 'ativa' || p.status === 'presente') a.inscritos++
    else if (p.status === 'espera') a.espera++
    ajustes.set(p.gameId, a)
  }
  await apagar(inscricoes.map((d) => d.ref))
  for (const [gameId, a] of ajustes) {
    if (!a.inscritos && !a.espera) continue
    // o jogo pode já ter sido apagado: aí não há contador para acertar
    await updateDoc(doc(db, 'games', gameId), {
      ...(a.inscritos ? { inscritos: increment(-a.inscritos) } : {}),
      ...(a.espera ? { espera: increment(-a.espera) } : {}),
    }).catch(() => {})
  }
  return inscricoes.length
}

/**
 * Admin: apaga dados de teste de um jogador (só o que foi marcado). Cada parte se basta, mas o
 * contador de jogos/mensalidades anda junto com os dados que ele conta.
 * Devolve uma linha por etapa, para mostrar ao admin o que foi feito.
 */
export async function resetarJogador(uid: string, o: OpcoesReset): Promise<string[]> {
  const feito: string[] = []

  if (o.extrato) {
    const lancamentos = await docsDoJogador('ledger', uid)
    await apagar(lancamentos.map((d) => d.ref))
    await setDoc(doc(db, 'wallets', uid), {
      creditos: 0,
      ultimoJogoId: null,
      ultimaConquistaId: null,
      atualizadoEm: serverTimestamp(),
    })
    feito.push(`Extrato: ${lancamentos.length} lançamento(s) apagado(s) e saldo zerado.`)
  }

  if (o.conquistas) {
    const selos = await docsDoJogador('conquistas', uid)
    await apagar(selos.map((d) => d.ref))
    // sem conquistas, a carteirinha também fica sem insígnias
    await updateDoc(doc(db, 'players', uid), { destaques: [], atualizadoEm: serverTimestamp() }).catch(() => {})
    await updateDoc(doc(db, 'publicCards', uid), { destaques: [], atualizadoEm: serverTimestamp() }).catch(() => {})
    feito.push(`Conquistas: ${selos.length} selo(s) apagado(s).`)
  }

  if (o.jogos) {
    const apagadas = await apagarInscricoesDoJogador(uid)
    await setDoc(doc(db, 'stats', uid), { jogos: 0, noturnos: 0, atualizadoEm: serverTimestamp() }, { merge: true })
    feito.push(`Jogos: ${apagadas} inscrição(ões)/presença(s) apagada(s) e contadores zerados.`)
  }

  if (o.mensalidades) {
    const pagamentos = await docsDoJogador('payments', uid)
    await apagar(pagamentos.map((d) => d.ref))
    const jogador = await getDoc(doc(db, 'players', uid))
    if (jogador.exists() && (jogador.data() as Player).status !== 'inativo') {
      await updateDoc(doc(db, 'players', uid), {
        status: 'inadimplente',
        vencimento: null,
        ultimoPagamento: null,
        atualizadoEm: serverTimestamp(),
      })
      await updateDoc(doc(db, 'publicCards', uid), {
        status: 'inadimplente',
        vencimento: null,
        atualizadoEm: serverTimestamp(),
      }).catch(() => {})
    }
    await setDoc(doc(db, 'stats', uid), { mensalidades: 0, atualizadoEm: serverTimestamp() }, { merge: true })
    feito.push(`Mensalidade: ${pagamentos.length} pagamento(s) apagado(s) e situação voltou para inadimplente.`)
  }

  return feito
}
