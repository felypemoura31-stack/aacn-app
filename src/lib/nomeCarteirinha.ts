/**
 * Nome na frente da carteirinha: sempre em UMA linha. Se o nome inteiro não cabe nem com a letra um pouco menor,
 * abrevia os nomes do meio, um de cada vez, da esquerda para a direita ("Ryan Pablo Borges Soares de Oliveira" vira
 * "Ryan P. B. Soares de Oliveira" e assim por diante), sempre mantendo o primeiro nome e o último sobrenome.
 * "de", "da", "do", "dos", "das", "e" ficam como estão. Só no último caso (nome enorme, sem nada a abreviar) a letra
 * diminui mais, até um mínimo.
 *
 * A medida usa a mesma fonte do CSS (`.cc-face`), então vale igual na tela, na prévia reduzida e na impressão.
 */

const FONTE = '"Segoe UI", Roboto, Arial, sans-serif'
const PX_POR_PT = 96 / 72
/** Largura útil do nome na frente (85,6 mm menos margens, foto e espaços), com uma folga. */
const LARGURA_MM = 57.5
const PX_POR_MM = 96 / 25.4
const LARGURA_PX = LARGURA_MM * PX_POR_MM

/** Tamanhos preferidos (pt): o nome inteiro tenta o maior primeiro e vai diminuindo até o mínimo "confortável". */
const TAMANHOS = [12.5, 11.5, 10.5, 10]
/** Se nem abreviado cabe (sobrenome gigante), a letra pode ir um pouco abaixo disso. */
const TAMANHO_MINIMO = 7.5

const LIGACOES = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'di', 'du', 'del', 'la', 'van', 'von'])

let canvas: CanvasRenderingContext2D | null | undefined

function largura(texto: string, pt: number) {
  if (canvas === undefined) canvas = document.createElement('canvas').getContext('2d')
  if (!canvas) return texto.length * pt * PX_POR_PT * 0.6 // sem canvas: estimativa
  canvas.font = `800 ${pt * PX_POR_PT}px ${FONTE}`
  return canvas.measureText(texto).width
}

/** Quantidade de nomes do meio que podem virar inicial (primeiro e último nomes e as ligações ficam de fora). */
function indicesDoMeio(partes: string[]) {
  const idx: number[] = []
  for (let i = 1; i < partes.length - 1; i++) if (!LIGACOES.has(partes[i].toLowerCase())) idx.push(i)
  return idx
}

function abreviar(partes: string[], quantos: number, meio: number[]) {
  const marcados = new Set(meio.slice(0, quantos))
  return partes.map((p, i) => (marcados.has(i) ? `${p.charAt(0).toLocaleUpperCase('pt-BR')}.` : p)).join(' ')
}

export function nomeNaCarteirinha(nomeCompleto: string): { texto: string; pt: number } {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean)
  const inteiro = partes.join(' ')
  const meio = indicesDoMeio(partes)

  // do nome inteiro até todos os nomes do meio abreviados
  for (let n = 0; n <= meio.length; n++) {
    const texto = n === 0 ? inteiro : abreviar(partes, n, meio)
    const pt = TAMANHOS.find((t) => largura(texto, t) <= LARGURA_PX)
    if (pt) return { texto, pt }
  }

  // sem mais o que abreviar: diminui a letra até caber (ou até o mínimo; o CSS corta o que sobrar)
  const texto = meio.length ? abreviar(partes, meio.length, meio) : inteiro
  let pt = TAMANHOS[TAMANHOS.length - 1]
  while (pt > TAMANHO_MINIMO && largura(texto, pt) > LARGURA_PX) pt -= 0.25
  return { texto, pt }
}
