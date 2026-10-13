import { formatarCreditos, reais } from './credits'
import type { Game } from '../types'

/**
 * "Adicionar ao calendário": monta o evento do jogo para o Google Agenda (link) e para qualquer outro calendário
 * (arquivo .ics: Apple/iPhone, Outlook, etc.). O lembrete sai do próprio calendário do celular, então funciona
 * com o app fechado.
 */

/** Duração presumida do jogo quando só se sabe o horário de início. */
const DURACAO_HORAS = 4

/** O Brasil não tem horário de verão desde 2019: o horário de Brasília é sempre UTC−3. */
const DESLOCAMENTO_HORAS = 3

const HORA = /^(\d{2}):(\d{2})$/

interface Janela {
  inicio: Date
  fim: Date
  diaInteiro: boolean
}

export function janelaDoJogo(g: Pick<Game, 'data' | 'horario'>): Janela {
  const [a, m, d] = g.data.split('-').map(Number)
  const hm = g.horario ? HORA.exec(g.horario) : null
  if (hm) {
    const inicio = new Date(Date.UTC(a, m - 1, d, Number(hm[1]) + DESLOCAMENTO_HORAS, Number(hm[2])))
    return { inicio, fim: new Date(inicio.getTime() + DURACAO_HORAS * 3600_000), diaInteiro: false }
  }
  // sem horário: evento de dia inteiro
  const inicio = new Date(Date.UTC(a, m - 1, d))
  return { inicio, fim: new Date(inicio.getTime() + 24 * 3600_000), diaInteiro: true }
}

const dois = (n: number) => String(n).padStart(2, '0')

/** 20261012T103000Z (horário) ou 20261012 (dia inteiro) */
function formatoIcs(d: Date, diaInteiro: boolean) {
  const dia = `${d.getUTCFullYear()}${dois(d.getUTCMonth() + 1)}${dois(d.getUTCDate())}`
  return diaInteiro ? dia : `${dia}T${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}Z`
}

/** Texto do evento: o que o jogador precisa saber e o caminho de volta para o jogo no app. */
export function textoDoEvento(g: Game, origem: string) {
  const linhas = [`Jogo da AACN. Valor: ${reais(g.valor)} ou ${formatarCreditos(g.custoCreditos)} créditos.`]
  if (g.descricao) linhas.push(g.descricao)
  if (g.localLink) linhas.push(`Mapa: ${g.localLink}`)
  linhas.push(`Detalhes e inscrição: ${origem}/jogos?jogo=${g.id}`)
  return linhas.join('\n')
}

export function linkGoogleAgenda(g: Game, origem: string) {
  const j = janelaDoJogo(g)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${g.nome} (AACN)`,
    dates: `${formatoIcs(j.inicio, j.diaInteiro)}/${formatoIcs(j.fim, j.diaInteiro)}`,
    details: textoDoEvento(g, origem),
    location: g.local ?? '',
    ctz: 'America/Sao_Paulo',
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

/** Escapa o texto no formato do arquivo de calendário (vírgula, ponto e vírgula, barra e quebra de linha). */
const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** O formato manda quebrar linhas longas (75 bytes): quebra em pedaços menores, sem cortar uma letra no meio. */
function dobrar(linha: string) {
  const partes: string[] = []
  let atual = ''
  let bytes = 0
  for (const ch of linha) {
    const b = new TextEncoder().encode(ch).length
    if (bytes + b > (partes.length === 0 ? 72 : 71)) {
      partes.push(atual)
      atual = ''
      bytes = 0
    }
    atual += ch
    bytes += b
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

/** Conteúdo do arquivo .ics, com lembretes um dia e duas horas antes (um dia de manhã, se o jogo não tem horário). */
export function gerarIcs(g: Game, origem: string, agora = new Date()) {
  const j = janelaDoJogo(g)
  const alarme = (gatilho: string, texto: string) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(texto)}`, `TRIGGER:${gatilho}`, 'END:VALARM']
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AACN//Jogos//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:jogo-${g.id}@aacn.web.app`,
    `DTSTAMP:${formatoIcs(agora, false)}`,
    j.diaInteiro ? `DTSTART;VALUE=DATE:${formatoIcs(j.inicio, true)}` : `DTSTART:${formatoIcs(j.inicio, false)}`,
    j.diaInteiro ? `DTEND;VALUE=DATE:${formatoIcs(j.fim, true)}` : `DTEND:${formatoIcs(j.fim, false)}`,
    `SUMMARY:${escapar(`${g.nome} (AACN)`)}`,
    `DESCRIPTION:${escapar(textoDoEvento(g, origem))}`,
    ...(g.local ? [`LOCATION:${escapar(g.local)}`] : []),
    `URL:${origem}/jogos?jogo=${g.id}`,
    'STATUS:CONFIRMED',
    ...(j.diaInteiro ? alarme('-PT15H', `Amanhã: ${g.nome}`) : [...alarme('-P1D', `Amanhã: ${g.nome}`), ...alarme('-PT2H', `Daqui a 2 horas: ${g.nome}`)]),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return linhas.map(dobrar).join('\r\n') + '\r\n'
}

/** Baixa o .ics do jogo (no iPhone e no Android, o próprio sistema oferece adicionar ao calendário). */
export function baixarIcs(g: Game, origem: string) {
  const blob = new Blob([gerarIcs(g, origem)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jogo-${g.data}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
