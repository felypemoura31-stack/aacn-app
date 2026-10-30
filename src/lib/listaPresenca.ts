import { formatarCreditos, reais } from './credits'
import { paraMillis } from './status'
import type { Game, Participation } from '../types'

/** Endereço que abre direto o jogo na tela de inscrição (se a pessoa não estiver logada, entra e cai nele). */
export function linkDoJogo(game: Pick<Game, 'id'>, origem: string = window.location.origin) {
  return `${origem}/jogos?jogo=${encodeURIComponent(game.id)}`
}

/**
 * Ordem em que as pessoas se inscreveram (quem entrou primeiro vem primeiro). Inscrição que acabou de ser gravada e ainda
 * não tem a hora do servidor vai para o fim, que é onde ela está; empate desempata pelo nome.
 */
export function ordemDeInscricao(a: Participation, b: Participation) {
  const ma = paraMillis(a.criadoEm) ?? Infinity
  const mb = paraMillis(b.criadoEm) ?? Infinity
  if (ma === mb) return a.jogadorNome.localeCompare(b.jogadorNome, 'pt-BR')
  return ma < mb ? -1 : 1
}

/** Texto da lista de presença para enviar no WhatsApp (inscritos na ordem em que se inscreveram). */
export function montarListaWhatsapp(
  game: Game,
  participacoes: Participation[],
  timePorJogador: Map<string, string | null> = new Map(),
): string {
  const nome = (p: Participation) => {
    if (p.convidado) return `${p.jogadorNome} - convidado`
    const time = timePorJogador.get(p.uid)
    return time ? `${p.jogadorNome} - ${time}` : p.jogadorNome
  }
  const inscritos = participacoes.filter((p) => p.status === 'ativa' || p.status === 'presente').sort(ordemDeInscricao)
  const espera = participacoes.filter((p) => p.status === 'espera').sort(ordemDeInscricao)

  const [a, m, d] = game.data.split('-')
  const linhas: string[] = [game.nome]
  if (game.local) linhas.push(game.local)
  linhas.push(`${d}/${m}/${a}`)
  if (game.horario) linhas.push(`chegada às: ${game.horario}`)
  linhas.push(`valor: ${reais(game.valor)}`)
  linhas.push(`valor para associados: ${formatarCreditos(game.custoCreditos)} créditos`)
  linhas.push('', 'Lista de operadores:')
  if (inscritos.length === 0) linhas.push('(ninguém inscrito ainda)')
  inscritos.forEach((p, i) => linhas.push(`${i + 1}-${nome(p)}`))
  if (espera.length > 0) {
    linhas.push('', 'Lista de espera:')
    espera.forEach((p, i) => linhas.push(`${i + 1}-${nome(p)}`))
  }
  linhas.push('', 'Se inscreva pelo link:', linkDoJogo(game))
  return linhas.join('\n')
}

/** Abre o WhatsApp com o texto pronto; a pessoa escolhe o grupo (ou contato) para enviar. */
export function linkEnviarWhatsapp(texto: string) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}
