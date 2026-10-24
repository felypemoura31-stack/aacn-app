import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { auditar } from './auditoria'
import type { Autor } from './credits'
import type { Game } from '../types'

/**
 * Sorteio de times dos jogadores presentes num jogo, equilibrado por PESO: cada jogador tem um peso (0 = Highlander, 1 = novato ...
 * 5 = veterano, até 9) que só o admin define; o sorteio espalha os pesos para que a soma de cada time fique parecida
 * e o número de jogadores de cada time difira no máximo em 1. Continua sendo sorteio: entre as divisões equilibradas
 * sai uma ao acaso, então refazer dá outro resultado.
 */

/** Escala de 10 níveis: 0 (Highlander, abaixo do novato) a 9. Novato continua 1 e veterano 5; acima do veterano ficam 6, 7, 8 e 9. */
export const PESO_MIN = 0
export const PESO_MAX = 9
export const PESO_PADRAO = 1

/** Mantém o peso dentro da escala (pesos antigos de 10, de quando a escala ia até 10, valem 9). */
export const ajustarPeso = (n: number) => Math.min(PESO_MAX, Math.max(PESO_MIN, Math.round(n)))

export function rotuloDoPeso(peso: number) {
  if (peso <= 0) return 'Highlander'
  if (peso === 1) return 'Novato'
  if (peso === 2) return 'Iniciante'
  if (peso === 3) return 'Intermediário'
  if (peso === 4) return 'Experiente'
  if (peso === 5) return 'Veterano'
  return 'Acima do veterano'
}

export const NOMES_PADRAO_DOS_TIMES = ['Azul', 'Vermelho', 'Verde', 'Amarelo', 'Laranja', 'Roxo', 'Preto', 'Branco']

export interface JogadorSorteio {
  uid: string
  nome: string
  peso: number
}

export interface TimeSorteado {
  nome: string
  jogadores: JogadorSorteio[]
  /** Soma dos pesos. */
  total: number
}

function embaralhar<T>(lista: T[], aleatorio: () => number): T[] {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Uma divisão: do mais forte ao mais fraco, cada jogador vai para o time de menor soma que ainda tem vaga. */
function umaDivisao(jogadores: JogadorSorteio[], k: number, aleatorio: () => number): JogadorSorteio[][] {
  const n = jogadores.length
  // tamanhos: no máximo 1 de diferença; os times que ficam com um a mais são escolhidos ao acaso
  const base = Math.floor(n / k)
  const extra = n % k
  const capacidade = Array<number>(k).fill(base)
  embaralhar([...Array(k).keys()], aleatorio)
    .slice(0, extra)
    .forEach((i) => capacidade[i]++)

  // empates de peso ficam em ordem aleatória (o sort é estável)
  const ordem = embaralhar(jogadores, aleatorio).sort((a, b) => b.peso - a.peso)
  const times: JogadorSorteio[][] = Array.from({ length: k }, () => [])
  const totais = Array<number>(k).fill(0)
  for (const j of ordem) {
    const livres = [...Array(k).keys()].filter((i) => times[i].length < capacidade[i])
    const menor = Math.min(...livres.map((i) => totais[i]))
    const empatados = livres.filter((i) => totais[i] === menor)
    const i = empatados[Math.floor(aleatorio() * empatados.length)]
    times[i].push(j)
    totais[i] += j.peso
  }
  return times
}

const diferenca = (times: JogadorSorteio[][]) => {
  const somas = times.map((t) => t.reduce((s, j) => s + j.peso, 0))
  return Math.max(...somas) - Math.min(...somas)
}

/**
 * Sorteia `quantidade` times. Faz várias divisões ao acaso e sorteia entre as mais equilibradas (diferença de soma
 * até `tolerancia` pontos acima da melhor encontrada), para o resultado ser justo e, ainda assim, imprevisível.
 */
export function sortearTimes(
  jogadores: JogadorSorteio[],
  quantidade: number,
  nomes: string[] = NOMES_PADRAO_DOS_TIMES,
  aleatorio: () => number = Math.random,
  tentativas = 400,
  tolerancia = 1,
): TimeSorteado[] {
  if (quantidade < 2) throw new Error('Escolha pelo menos 2 times.')
  if (jogadores.length < quantidade) throw new Error('Há menos jogadores do que times.')

  const divisoes: { times: JogadorSorteio[][]; dif: number }[] = []
  for (let i = 0; i < tentativas; i++) {
    const times = umaDivisao(jogadores, quantidade, aleatorio)
    divisoes.push({ times, dif: diferenca(times) })
  }
  const melhor = Math.min(...divisoes.map((d) => d.dif))
  const boas = divisoes.filter((d) => d.dif <= melhor + tolerancia)
  const escolhida = boas[Math.floor(aleatorio() * boas.length)].times

  return escolhida.map((jogs, i) => ({
    nome: nomes[i]?.trim() || NOMES_PADRAO_DOS_TIMES[i] || `Time ${i + 1}`,
    jogadores: [...jogs].sort((a, b) => b.peso - a.peso || a.nome.localeCompare(b.nome, 'pt-BR')),
    total: jogs.reduce((s, j) => s + j.peso, 0),
  }))
}

/** Texto pronto para colar no WhatsApp (sem pesos: eles são só da diretoria). */
export function textoDoSorteio(jogo: Pick<Game, 'nome' | 'data'>, times: { nome: string; jogadores: { nome: string }[] }[]) {
  const quando = new Date(jogo.data + 'T12:00').toLocaleDateString('pt-BR')
  const blocos = times.map((t) => `*${t.nome}* (${t.jogadores.length})\n${t.jogadores.map((j) => `• ${j.nome}`).join('\n')}`)
  return `🎯 *Times sorteados* — ${jogo.nome} (${quando})\n\n${blocos.join('\n\n')}`
}

export function linkWhatsappTexto(texto: string) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

// ---------- gravação

/** Grava (ou refaz) o sorteio do jogo como RASCUNHO: os jogadores só veem depois de "Publicar". Sem pesos no documento. */
export async function salvarSorteio(jogo: Pick<Game, 'id' | 'nome'>, times: TimeSorteado[], autor: Autor) {
  const lote = writeBatch(db)
  lote.set(doc(db, 'sorteios', jogo.id), {
    gameId: jogo.id,
    times: times.map((t) => ({ nome: t.nome, jogadores: t.jogadores.map((j) => ({ uid: j.uid, nome: j.nome })) })),
    publicado: false,
    criadoPor: autor.uid,
    criadoPorNome: autor.nome,
    criadoEm: serverTimestamp(),
  })
  auditar(lote, {
    acao: 'sorteio_times',
    resumo: `Sorteou ${times.length} times em "${jogo.nome}": ${times.map((t) => `${t.nome} (${t.jogadores.length})`).join(', ')}`,
    autor,
  })
  await lote.commit()
}

/** Mostra o sorteio aos jogadores (ou tira da vista). Só mexe em publicado/publicadoEm: times e autoria ficam como estão. */
export async function publicarSorteio(jogo: Pick<Game, 'id' | 'nome'>, publicado: boolean, autor: Autor) {
  const lote = writeBatch(db)
  lote.update(doc(db, 'sorteios', jogo.id), { publicado, publicadoEm: serverTimestamp() })
  auditar(lote, {
    acao: 'sorteio_times',
    resumo: `${publicado ? 'Publicou aos jogadores' : 'Retirou da vista dos jogadores'} o sorteio de times de "${jogo.nome}"`,
    autor,
  })
  await lote.commit()
}

/** Só o admin define o peso (as regras do banco impedem os outros). Fica no histórico de ações. */
export async function definirPeso(jogador: { uid: string; nome: string }, antes: number, peso: number, autor: Autor) {
  if (!Number.isInteger(peso) || peso < PESO_MIN || peso > PESO_MAX) throw new Error(`O peso vai de ${PESO_MIN} a ${PESO_MAX}.`)
  const lote = writeBatch(db)
  lote.set(doc(db, 'pesos', jogador.uid), { peso, definidoPor: autor.uid, definidoPorNome: autor.nome, definidoEm: serverTimestamp() })
  auditar(lote, {
    acao: 'peso_sorteio',
    resumo: `Mudou o peso de ${jogador.nome} no sorteio de times: ${antes} (${rotuloDoPeso(antes)}) para ${peso} (${rotuloDoPeso(peso)})`,
    autor,
    alvo: jogador,
  })
  await lote.commit()
}
