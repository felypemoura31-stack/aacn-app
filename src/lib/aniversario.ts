import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { lerCarteira } from './credits'
import type { Player } from '../types'

/** Igual a bonusAniversario() em firestore.rules. */
export const BONUS_ANIVERSARIO = 10

/** "Hoje" em Brasília (UTC-3), o mesmo fuso que as regras do banco usam, e não o do aparelho. */
export function hojeEmBrasilia(agora = Date.now()) {
  const d = new Date(agora - 3 * 3600_000)
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() }
}

const ehBissexto = (ano: number) => ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)

/** Hoje é o aniversário? Quem nasceu em 29/02 comemora em 28/02 nos anos sem 29/02 (como nas regras do banco). */
export function ehAniversarioHoje(dataNascimento: string | undefined, agora = Date.now()) {
  const m = (dataNascimento ?? '').match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (!m) return false
  const mes = Number(m[1])
  const dia = Number(m[2])
  const hoje = hojeEmBrasilia(agora)
  if (mes === hoje.mes && dia === hoje.dia) return true
  return mes === 2 && dia === 29 && !ehBissexto(hoje.ano) && hoje.mes === 2 && hoje.dia === 28
}

export const primeiroNome = (nomeCompleto: string) => nomeCompleto.trim().split(/\s+/)[0] || 'associado'

const MENSAGENS: ((n: string) => string)[] = [
  (n) => `Parabéns, ${n}! Mais um ano de vida e, ao contrário do seu hop-up, você continua bem calibrado. 🎯`,
  (n) => `Feliz aniversário, ${n}! Hoje você tem imunidade total: ninguém pode gritar "tá morto!" com você. Aproveite o bolo antes que apareça algum "hit". 🎂`,
  (n) => `${n}, mais um ano no mapa! Que a sua vida tenha menos jam e mais tiro certeiro, e que a bateria dure mais que o fôlego na subida do morro. 🔋`,
  (n) => `Parabéns, ${n}! O bolo hoje é por conta da casa, mas as bolinhas que você deixou no mato a gente ainda cobra. 😄`,
  (n) => `Feliz aniversário, ${n}! Que o seu próximo ano seja como o seu melhor flanqueamento: silencioso, bem planejado e com todo mundo surpreso. 🤫`,
  (n) => `${n}, hoje ninguém precisa gritar "hit!": só "parabéns!". Que venham muitos anos, pouca poeira e nenhuma bolinha na viseira. 🥳`,
  (n) => `Parabéns, ${n}! Dizem que com a idade vem a experiência. A sua só ainda não chegou nos joelhos. Feliz aniversário! 🦵`,
  (n) => `Mais um ano, ${n}! Que a sua vida seja um jogo de domingo: sol, boa companhia, café na concentração e nenhum "alguém viu minha bolinha?". ☀️`,
  (n) => `Feliz aniversário, ${n}! Hoje o único alvo permitido é o bolo. Mire bem, respeite o cronômetro e, por favor, sem fogo amigo na última fatia. 🍰`,
  (n) => `Parabéns, ${n}! Que o seu ano tenha rádio sem chiado, zero atraso na concentração e um ponto de respawn sempre perto do bolo. 📻`,
  (n) => `${n}, o QG inteiro manda um "câmbio, desligo" de parabéns! Muita munição, pouca chuva em dia de jogo e uma mira à prova de vento. 🌬️`,
  (n) => `Feliz aniversário, ${n}! Seu nível de XP subiu mais um ponto. Gaste os ${BONUS_ANIVERSARIO} créditos com sabedoria: um jogo ou um lanche pós-batalha, você escolhe. 🍔`,
]

/** A mensagem do dia: fixa para a pessoa naquele ano (não muda a cada abertura) e diferente de um ano para o outro. */
export function mensagemDeAniversario(nomeCompleto: string, uid: string, ano: number) {
  let h = ano
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return MENSAGENS[h % MENSAGENS.length](primeiroNome(nomeCompleto))
}

/**
 * O jogador toca em "Lido" no aviso de aniversário e recebe os créditos. As regras do banco conferem que hoje é mesmo o
 * aniversário dele (data de nascimento do cadastro, horário de Brasília) e amarram, no mesmo lote: o documento do ano
 * (um por jogador e ano, não se repete), a soma exata do bônus na carteira e o lançamento no extrato.
 */
export async function receberBonusAniversario(player: Pick<Player, 'uid' | 'nomeCompleto'>) {
  const ano = hojeEmBrasilia().ano
  let carteira = await lerCarteira(player.uid)
  if (!carteira.existe) {
    await setDoc(doc(db, 'wallets', player.uid), { creditos: 0, ultimoJogoId: null, atualizadoEm: serverTimestamp() })
    carteira = await lerCarteira(player.uid)
  }
  const saldoApos = Math.round((carteira.saldo + BONUS_ANIVERSARIO) * 100) / 100

  const batch = writeBatch(db)
  batch.update(doc(db, 'wallets', player.uid), {
    creditos: saldoApos,
    ultimoAniversarioId: String(ano),
    atualizadoEm: serverTimestamp(),
  })
  batch.set(doc(db, 'aniversarios', `${player.uid}_${ano}`), {
    uid: player.uid,
    ano,
    creditos: BONUS_ANIVERSARIO,
    criadoEm: serverTimestamp(),
  })
  batch.set(doc(db, 'ledger', `aniversario_${player.uid}_${ano}`), {
    uid: player.uid,
    tipo: 'bonus',
    creditos: BONUS_ANIVERSARIO,
    saldoApos,
    descricao: 'Feliz aniversário! Presente da AACN',
    refId: String(ano),
    porUid: player.uid,
    porNome: player.nomeCompleto,
    criadoEm: serverTimestamp(),
  })
  await batch.commit()
}
