import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type {
  Game,
  LedgerTipo,
  Participation,
  Player,
  Wallet,
} from '../types'

export const CREDITOS_POR_REAL = 2

/** Jogo noturno: começa às 18:00 ou depois (o horário é "HH:MM"; sem horário, não é noturno). */
export const HORA_NOTURNO = '18:00'

export function ehNoturno(game: Pick<Game, 'horario'>) {
  return typeof game.horario === 'string' && game.horario >= HORA_NOTURNO
}

export interface Autor {
  uid: string
  nome: string
}

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

export function novoId() {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function lerCarteira(uid: string) {
  const snap = await getDoc(doc(db, 'wallets', uid))
  return {
    existe: snap.exists(),
    saldo: snap.exists() ? (snap.data() as Wallet).creditos : 0,
    ultimoJogoId: snap.exists() ? (snap.data() as Wallet).ultimoJogoId : null,
  }
}

/**
 * Contadores que alimentam as conquistas (jogos jogados, jogos noturnos, mensalidades pagas).
 * Vão no mesmo lote do fato que contam (check-in, pagamento), para nunca ficarem fora de sincronia.
 */
export function contar(
  batch: WriteBatch,
  uid: string,
  d: { jogos?: number; noturnos?: number; mensalidades?: number; ultimoJogoId?: string },
) {
  const dados: Record<string, unknown> = { atualizadoEm: serverTimestamp() }
  if (d.jogos !== undefined) dados.jogos = increment(d.jogos)
  if (d.noturnos !== undefined) dados.noturnos = increment(d.noturnos)
  if (d.mensalidades !== undefined) dados.mensalidades = increment(d.mensalidades)
  if (d.ultimoJogoId !== undefined) dados.ultimoJogoId = d.ultimoJogoId
  batch.set(doc(db, 'stats', uid), dados, { merge: true })
}

/** Grava a mudança de saldo e o lançamento no extrato, sempre juntos no mesmo lote. */
export function lancar(
  batch: WriteBatch,
  p: {
    uid: string
    saldoAntes: number
    delta: number
    tipo: LedgerTipo
    descricao: string
    refId: string | null
    autor: Autor
    ledgerId?: string
    ultimoJogoId?: string | null
    existe?: boolean
  },
) {
  const saldoApos = arredondar(p.saldoAntes + p.delta)
  if (saldoApos < 0) throw new Error('O saldo não pode ficar negativo')

  const carteira: Record<string, unknown> = {
    creditos: saldoApos,
    atualizadoEm: serverTimestamp(),
  }
  if (p.ultimoJogoId !== undefined) carteira.ultimoJogoId = p.ultimoJogoId
  if (p.existe === false) {
    batch.set(doc(db, 'wallets', p.uid), { ultimoJogoId: null, ...carteira })
  } else {
    batch.update(doc(db, 'wallets', p.uid), carteira)
  }

  batch.set(doc(db, 'ledger', p.ledgerId ?? novoId()), {
    uid: p.uid,
    tipo: p.tipo,
    creditos: arredondar(p.delta),
    saldoApos,
    descricao: p.descricao,
    refId: p.refId,
    porUid: p.autor.uid,
    porNome: p.autor.nome,
    criadoEm: serverTimestamp(),
  })
}

/**
 * O jogador se inscreve no site. NÃO debita nada: o débito acontece no dia, no check-in por QR.
 * Se o jogo está lotado, entra na lista de espera. O contador de vagas do jogo é atualizado no
 * mesmo lote (as regras do banco exigem isso, para ninguém passar do limite).
 */
export async function inscreverNoJogo(player: Player, game: Game): Promise<'ativa' | 'espera'> {
  const lotado = game.vagas != null && (game.inscritos ?? 0) >= game.vagas
  const status = lotado ? 'espera' : 'ativa'
  const batch = writeBatch(db)
  batch.set(doc(db, 'participations', participationId(game.id, player.uid)), {
    gameId: game.id,
    gameNome: game.nome,
    uid: player.uid,
    jogadorNome: player.nomeCompleto,
    pagoCom: 'pendente',
    creditosDebitados: 0,
    status,
    criadoEm: serverTimestamp(),
  })
  batch.update(doc(db, 'games', game.id), lotado ? { espera: increment(1) } : { inscritos: increment(1) })
  await batch.commit()
  return status
}

/** O jogador desiste da inscrição (ou da espera) enquanto ainda não houve check-in. */
export async function cancelarMinhaInscricao(p: Participation) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'participations', p.id))
  batch.update(doc(db, 'games', p.gameId), p.status === 'espera' ? { espera: increment(-1) } : { inscritos: increment(-1) })
  await batch.commit()
}

/** Staff chama alguém da lista de espera: passa a inscrito e os contadores acompanham. */
export async function promoverDaEspera(p: Participation) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'participations', p.id), { status: 'ativa' })
  batch.update(doc(db, 'games', p.gameId), { espera: increment(-1), inscritos: increment(1) })
  await batch.commit()
}

/**
 * Check-in no dia do jogo (admin, tesoureiro ou organizador): marca a presença e
 * cobra. Com créditos, o débito, o extrato e a presença vão no mesmo lote; em
 * dinheiro, só registra a presença e quem recebeu.
 */
export async function fazerCheckIn(
  game: Game,
  p: Participation,
  modo: 'creditos' | 'dinheiro',
  autor: Autor,
) {
  const batch = writeBatch(db)
  let debitado = 0
  if (modo === 'creditos') {
    const c = await lerCarteira(p.uid)
    if (c.saldo < game.custoCreditos) throw new Error('Saldo de créditos insuficiente')
    debitado = game.custoCreditos
    lancar(batch, {
      uid: p.uid,
      saldoAntes: c.saldo,
      delta: -debitado,
      tipo: 'jogo',
      descricao: `Check-in: ${game.nome}`,
      refId: game.id,
      autor,
      ledgerId: `checkin_${game.id}_${p.uid}`,
      ultimoJogoId: game.id,
      existe: c.existe,
    })
  }
  batch.update(doc(db, 'participations', p.id), {
    status: 'presente',
    pagoCom: modo,
    creditosDebitados: debitado,
    presenteEm: serverTimestamp(),
    checkInPor: autor.uid,
    checkInPorNome: autor.nome,
  })
  contar(batch, p.uid, { jogos: 1, noturnos: ehNoturno(game) ? 1 : 0, ultimoJogoId: game.id })
  await batch.commit()
}

/** Admin/tesoureiro inscreve alguém na hora (sem inscrição prévia) já com check-in feito. */
export async function adminAdicionarParticipante(
  game: Game,
  jogador: Pick<Player, 'uid' | 'nomeCompleto'>,
  pagoCom: 'creditos' | 'dinheiro',
  admin: Autor,
) {
  const batch = writeBatch(db)
  const pid = participationId(game.id, jogador.uid)
  const atual = await getDoc(doc(db, 'participations', pid))
  const statusAtual = atual.exists() ? (atual.data() as Participation).status : null
  if (statusAtual === 'espera') batch.update(doc(db, 'games', game.id), { espera: increment(-1), inscritos: increment(1) })
  else if (statusAtual !== 'ativa' && statusAtual !== 'presente') batch.update(doc(db, 'games', game.id), { inscritos: increment(1) })
  let debitado = 0
  if (pagoCom === 'creditos') {
    const c = await lerCarteira(jogador.uid)
    if (c.saldo < game.custoCreditos) throw new Error('Saldo de créditos insuficiente')
    debitado = game.custoCreditos
    lancar(batch, {
      uid: jogador.uid,
      saldoAntes: c.saldo,
      delta: -debitado,
      tipo: 'jogo',
      descricao: `Inscrição e check-in (feitos pela diretoria): ${game.nome}`,
      refId: game.id,
      autor: admin,
      existe: c.existe,
    })
  }
  batch.set(doc(db, 'participations', participationId(game.id, jogador.uid)), {
    gameId: game.id,
    gameNome: game.nome,
    uid: jogador.uid,
    jogadorNome: jogador.nomeCompleto,
    pagoCom,
    creditosDebitados: debitado,
    status: 'presente',
    presenteEm: serverTimestamp(),
    checkInPor: admin.uid,
    checkInPorNome: admin.nome,
    criadoEm: serverTimestamp(),
  })
  // quem já estava presente (reinclusão) não conta de novo
  if (statusAtual !== 'presente') {
    contar(batch, jogador.uid, { jogos: 1, noturnos: ehNoturno(game) ? 1 : 0, ultimoJogoId: game.id })
  }
  await batch.commit()
}

/** Admin/tesoureiro cancela a inscrição (fica no histórico como "removida") e estorna o que foi debitado. */
export async function adminRemoverParticipante(p: Participation, admin: Autor) {
  const batch = writeBatch(db)
  if (p.status === 'presente') {
    // a presença deixa de contar (os bônus já resgatados continuam com o jogador)
    const jogo = await getDoc(doc(db, 'games', p.gameId))
    contar(batch, p.uid, { jogos: -1, noturnos: jogo.exists() && ehNoturno(jogo.data() as Game) ? -1 : 0 })
  }
  if (p.creditosDebitados > 0) {
    const c = await lerCarteira(p.uid)
    lancar(batch, {
      uid: p.uid,
      saldoAntes: c.saldo,
      delta: p.creditosDebitados,
      tipo: 'estorno',
      descricao: `Estorno: inscrição cancelada em ${p.gameNome}`,
      refId: p.gameId,
      autor: admin,
      existe: c.existe,
    })
  }
  batch.update(doc(db, 'participations', p.id), {
    status: 'removida',
    removidaEm: serverTimestamp(),
  })
  if (p.status === 'espera') batch.update(doc(db, 'games', p.gameId), { espera: increment(-1) })
  else if (p.status === 'ativa' || p.status === 'presente') batch.update(doc(db, 'games', p.gameId), { inscritos: increment(-1) })
  await batch.commit()
}

/** Ajuste manual do admin (positivo ou negativo), sempre com motivo registrado no extrato. */
export async function adminAjustarSaldo(
  jogador: Pick<Player, 'uid' | 'nomeCompleto'>,
  delta: number,
  motivo: string,
  admin: Autor,
) {
  if (!delta) throw new Error('Informe um valor diferente de zero')
  if (!motivo.trim()) throw new Error('Informe o motivo do ajuste')
  const c = await lerCarteira(jogador.uid)
  const batch = writeBatch(db)
  lancar(batch, {
    uid: jogador.uid,
    saldoAntes: c.saldo,
    delta,
    tipo: 'ajuste',
    descricao: motivo.trim(),
    refId: null,
    autor: admin,
    existe: c.existe,
  })
  await batch.commit()
}
