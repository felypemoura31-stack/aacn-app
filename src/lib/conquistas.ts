import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { DIA_MS } from './status'
import { lancar, lerCarteira } from './credits'
import { temCargo } from './roles'
import type { Estatisticas, Player } from '../types'

export interface ContextoConquistas {
  jogos: number
  noturnos: number
  mensalidades: number
  faltas: number
  dias: number
  timeAprovado: boolean
  /** Tem o cargo de parceiro (lojista). */
  parceiro: boolean
}

export type GrupoConquista = 'jogos' | 'noturnas' | 'associacao'

export interface DefConquista {
  id: string
  titulo: string
  desc: string
  bonus: number // créditos
  grupo: GrupoConquista
  icone: string
  /** Exclusiva: só aparece para quem a conquistou ou pode conquistar (hoje, quem tem o cargo de parceiro). */
  exclusiva?: boolean
  /** Contador que alimenta a conquista (para mostrar o progresso). */
  campo?: 'jogos' | 'noturnos' | 'mensalidades'
  meta?: number
  ok: (c: ContextoConquistas) => boolean
}

const porJogos = (id: string, titulo: string, meta: number, bonus: number, desc: string): DefConquista => ({
  id, titulo, desc, bonus, grupo: 'jogos', icone: '★', campo: 'jogos', meta, ok: (c) => c.jogos >= meta,
})
const porNoites = (id: string, titulo: string, meta: number, bonus: number, desc: string): DefConquista => ({
  id, titulo, desc, bonus, grupo: 'noturnas', icone: '☾', campo: 'noturnos', meta, ok: (c) => c.noturnos >= meta,
})

/**
 * Os valores dos bônus (e as metas) também estão nas regras do banco (firestore.rules):
 * se mudar aqui, mude lá também.
 */
export const CONQUISTAS: DefConquista[] = [
  porJogos('primeiro', 'Primeiro jogo', 1, 5, 'Jogou o primeiro jogo'),
  porJogos('campo', 'Em campo', 5, 10, '5 jogos jogados'),
  porJogos('veterano', 'Veterano', 10, 15, '10 jogos jogados'),
  porJogos('lenda', 'Lenda', 25, 20, '25 jogos jogados'),
  {
    id: 'assiduo',
    titulo: 'Assíduo',
    desc: 'Frequência de 80% ou mais (a partir de 5 jogos)',
    bonus: 20,
    grupo: 'jogos',
    icone: '★',
    ok: (c) => c.jogos >= 5 && c.jogos / (c.jogos + c.faltas) >= 0.8,
  },
  porNoites('noturno1', 'Primeiro noturno', 1, 5, 'Jogou um jogo noturno (a partir das 18h)'),
  porNoites('penumbra', 'Na penumbra', 5, 5, '5 jogos noturnos'),
  porNoites('escuridao', 'Na escuridão', 10, 10, '10 jogos noturnos'),
  porNoites('sombras', 'Senhor das sombras', 25, 20, '25 jogos noturnos'),
  {
    id: 'emdia',
    titulo: 'Em dia',
    desc: '3 ou mais mensalidades pagas',
    bonus: 30,
    grupo: 'associacao',
    icone: '★',
    campo: 'mensalidades',
    meta: 3,
    ok: (c) => c.mensalidades >= 3,
  },
  {
    id: 'ano',
    titulo: '1 ano de AACN',
    desc: 'Associado há um ano ou mais',
    bonus: 100,
    grupo: 'associacao',
    icone: '★',
    ok: (c) => c.dias >= 365,
  },
  {
    id: 'parceiro',
    titulo: 'Lojista parceiro',
    desc: 'Cargo de parceiro da AACN (exclusiva)',
    bonus: 10,
    grupo: 'associacao',
    icone: '★',
    exclusiva: true,
    ok: (c) => c.parceiro,
  },
  {
    id: 'time',
    titulo: 'Parte de um time',
    desc: 'Membro aprovado de um time',
    bonus: 5,
    grupo: 'associacao',
    icone: '★',
    ok: (c) => c.timeAprovado,
  },
]

export const GRUPOS: { id: GrupoConquista; titulo: string }[] = [
  { id: 'jogos', titulo: 'Jogos' },
  { id: 'noturnas', titulo: 'Jogos noturnos' },
  { id: 'associacao', titulo: 'Associação' },
]

export function contextoDoJogador(
  player: Pick<Player, 'timeAprovado' | 'role' | 'cargos'>,
  stats: Estatisticas | null,
  faltas: number,
  criadoEmMs: number | null,
): ContextoConquistas {
  return {
    jogos: stats?.jogos ?? 0,
    noturnos: stats?.noturnos ?? 0,
    mensalidades: stats?.mensalidades ?? 0,
    faltas,
    dias: criadoEmMs ? (Date.now() - criadoEmMs) / DIA_MS : 0,
    timeAprovado: !!player.timeAprovado,
    parceiro: temCargo(player, 'parceiro'),
  }
}

/**
 * O jogador resgata o bônus de uma conquista. As regras do banco conferem se ele realmente a
 * atingiu (contadores, cadastro) e amarram, no mesmo lote: o documento da conquista (um por
 * jogador, não se repete), a soma exata do bônus na carteira e o lançamento no extrato.
 */
export async function reivindicarConquista(player: Pick<Player, 'uid' | 'nomeCompleto'>, c: DefConquista) {
  let carteira = await lerCarteira(player.uid)
  if (!carteira.existe) {
    await setDoc(doc(db, 'wallets', player.uid), { creditos: 0, ultimoJogoId: null, atualizadoEm: serverTimestamp() })
    carteira = await lerCarteira(player.uid)
  }
  const saldoApos = Math.round((carteira.saldo + c.bonus) * 100) / 100

  const batch = writeBatch(db)
  batch.update(doc(db, 'wallets', player.uid), {
    creditos: saldoApos,
    ultimaConquistaId: c.id,
    atualizadoEm: serverTimestamp(),
  })
  batch.set(doc(db, 'conquistas', `${player.uid}_${c.id}`), {
    uid: player.uid,
    conquista: c.id,
    creditos: c.bonus,
    criadoEm: serverTimestamp(),
  })
  batch.set(doc(db, 'ledger', `bonus_${player.uid}_${c.id}`), {
    uid: player.uid,
    tipo: 'bonus',
    creditos: c.bonus,
    saldoApos,
    descricao: `Conquista: ${c.titulo}`,
    refId: c.id,
    porUid: player.uid,
    porNome: player.nomeCompleto,
    criadoEm: serverTimestamp(),
  })
  await batch.commit()
}

/**
 * Admin concede uma conquista a um jogador (sem conferir a meta). `creditar` soma o bônus na carteira e
 * lança no extrato, no mesmo lote.
 */
export async function concederConquista(
  alvo: { uid: string; nome: string },
  c: DefConquista,
  creditar: boolean,
  admin: { uid: string; nome: string },
) {
  const ref = doc(db, 'conquistas', `${alvo.uid}_${c.id}`)
  if ((await getDoc(ref)).exists()) throw new Error('Esta conquista já foi concedida.')

  const batch = writeBatch(db)
  batch.set(ref, {
    uid: alvo.uid,
    conquista: c.id,
    creditos: creditar ? c.bonus : 0,
    criadoEm: serverTimestamp(),
    concedidaPor: admin.uid,
    concedidaPorNome: admin.nome,
  })
  if (creditar) {
    const carteira = await lerCarteira(alvo.uid)
    lancar(batch, {
      uid: alvo.uid,
      saldoAntes: carteira.saldo,
      delta: c.bonus,
      tipo: 'bonus',
      descricao: `Conquista concedida pela diretoria: ${c.titulo}`,
      refId: c.id,
      autor: { uid: admin.uid, nome: admin.nome },
      existe: carteira.existe,
    })
  }
  await batch.commit()
}

/** Se a conquista estava entre as 3 da carteirinha, sai de lá (cadastro e cartão público). */
export async function tirarDosDestaques(uid: string, conquistaId: string) {
  try {
    const jogador = await getDoc(doc(db, 'players', uid))
    const atuais = ((jogador.data() as { destaques?: string[] } | undefined)?.destaques ?? []) as string[]
    if (!atuais.includes(conquistaId)) return
    const novos = atuais.filter((x) => x !== conquistaId)
    await updateDoc(doc(db, 'players', uid), { destaques: novos, atualizadoEm: serverTimestamp() })
    await updateDoc(doc(db, 'publicCards', uid), { destaques: novos, atualizadoEm: serverTimestamp() })
  } catch (e) {
    // a tela da carteirinha também ignora insígnias de conquistas que o jogador não tem mais
    console.warn('Não consegui tirar a conquista da carteirinha', e)
  }
}

/**
 * Admin remove uma conquista: ela volta a ser uma conquista "a conquistar", como se nunca tivesse sido ganha.
 * `retirarCreditos` desconta do saldo o bônus que ela tinha pago. Se o jogador ainda cumpre a meta, o app
 * dele a concede de novo sozinho na próxima vez que abrir.
 */
export async function removerConquista(
  alvo: { uid: string; nome: string },
  c: DefConquista,
  retirarCreditos: boolean,
  admin: { uid: string; nome: string },
) {
  const ref = doc(db, 'conquistas', `${alvo.uid}_${c.id}`)
  const atual = await getDoc(ref)
  if (!atual.exists()) throw new Error('Esta conquista não está concedida.')
  const pago = Number((atual.data() as { creditos?: number }).creditos ?? 0)

  const batch = writeBatch(db)
  batch.delete(ref)
  if (retirarCreditos && pago > 0) {
    const carteira = await lerCarteira(alvo.uid)
    if (carteira.saldo < pago) {
      throw new Error(`O saldo (${carteira.saldo}) é menor que o bônus (${pago}). Remova sem retirar os créditos ou ajuste o saldo em Créditos.`)
    }
    lancar(batch, {
      uid: alvo.uid,
      saldoAntes: carteira.saldo,
      delta: -pago,
      tipo: 'ajuste',
      descricao: `Conquista removida pela diretoria: ${c.titulo}`,
      refId: c.id,
      autor: { uid: admin.uid, nome: admin.nome },
      existe: carteira.existe,
    })
  }
  await batch.commit()
  await tirarDosDestaques(alvo.uid, c.id)
}
