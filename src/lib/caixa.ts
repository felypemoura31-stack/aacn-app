import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { auditar } from './auditoria'
import { novoId, reais, type Autor } from './credits'
import { paraMillis } from './status'
import type { Game, LancamentoCaixa, Participation, Payment, PrestacaoContas } from '../types'

/** Categorias sugeridas (a pessoa também pode digitar outra). */
export const CATEGORIAS_ENTRADA = ['Saldo inicial', 'Doação', 'Patrocínio', 'Venda', 'Outras entradas']
export const CATEGORIAS_SAIDA = ['Campo', 'Material', 'Premiação', 'Alimentação', 'Manutenção', 'Taxas', 'Outras saídas']

/** Entradas que o app soma sozinho (não se lançam à mão). */
export const CAT_MENSALIDADES = 'Mensalidades (Pix)'
export const CAT_JOGOS_DINHEIRO = 'Jogos pagos em dinheiro'

export interface Movimento {
  tipo: 'entrada' | 'saida'
  valor: number
  data: string // yyyy-mm-dd
  categoria: string
}

/** "12,50", "1.250,00" e "12.5" viram número; o que não for um valor positivo vira null. */
export function lerValor(txt: string): number | null {
  const s = txt.trim().replace(/[^\d.,]/g, '')
  if (!s) return null
  // com vírgula, o ponto é separador de milhar; sem vírgula, o ponto é o decimal
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

const dois = (n: number) => String(n).padStart(2, '0')

export function dataIsoDeMs(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

export const mesDe = (dataIso: string) => dataIso.slice(0, 7)

export function dataBr(iso: string) {
  const [a, m, d] = iso.split('-')
  return a && m && d ? `${d}/${m}/${a}` : iso
}

/** "2026-10" -> "Outubro de 2026" */
export function rotuloDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const doLancamento = (l: LancamentoCaixa): Movimento => ({ tipo: l.tipo, valor: l.valor, data: l.data, categoria: l.categoria })

/**
 * Entradas que já existem em outras partes do app: as mensalidades pagas por Pix (com baixa e não estornadas) e o que
 * foi pago em dinheiro no check-in dos jogos (valor do jogo × presença em dinheiro). Não são lançamentos: mudam
 * quando a baixa é estornada ou o jogo é editado.
 */
export function movimentosAutomaticos(pagamentos: Payment[], presencas: Participation[], jogos: Game[]): Movimento[] {
  const out: Movimento[] = []
  for (const p of pagamentos) {
    const ms = p.status === 'confirmado' ? paraMillis(p.dataPagamento) : null
    if (ms != null) out.push({ tipo: 'entrada', valor: p.valor, data: dataIsoDeMs(ms), categoria: CAT_MENSALIDADES })
  }
  const jogoPorId = new Map(jogos.map((g) => [g.id, g]))
  for (const pr of presencas) {
    const g = jogoPorId.get(pr.gameId)
    if (pr.status === 'presente' && pr.pagoCom === 'dinheiro' && g && g.valor > 0) {
      out.push({ tipo: 'entrada', valor: g.valor, data: g.data, categoria: CAT_JOGOS_DINHEIRO })
    }
  }
  return out
}

export interface ResumoDoMes {
  entradas: number
  saidas: number
  saldoMes: number
  entradasPorCategoria: Record<string, number>
  saidasPorCategoria: Record<string, number>
}

const centavos = (n: number) => Math.round(n * 100) / 100

/** Totais de um mês ("2026-10") ou de tudo ("todos"). */
export function resumir(movs: Movimento[], mes: string): ResumoDoMes {
  const r: ResumoDoMes = { entradas: 0, saidas: 0, saldoMes: 0, entradasPorCategoria: {}, saidasPorCategoria: {} }
  for (const m of movs) {
    if (mes !== 'todos' && mesDe(m.data) !== mes) continue
    const alvo = m.tipo === 'entrada' ? r.entradasPorCategoria : r.saidasPorCategoria
    alvo[m.categoria] = centavos((alvo[m.categoria] ?? 0) + m.valor)
    if (m.tipo === 'entrada') r.entradas = centavos(r.entradas + m.valor)
    else r.saidas = centavos(r.saidas + m.valor)
  }
  r.saldoMes = centavos(r.entradas - r.saidas)
  return r
}

/** Saldo do caixa até o fim do mês ("todos" = tudo o que existe). */
export function saldoAte(movs: Movimento[], mes: string) {
  let s = 0
  for (const m of movs) {
    if (mes === 'todos' || mesDe(m.data) <= mes) s += m.tipo === 'entrada' ? m.valor : -m.valor
  }
  return centavos(s)
}

/** Meses com movimento, do mais recente para o mais antigo, sempre com o mês atual. */
export function mesesComMovimento(movs: Movimento[]) {
  const set = new Set(movs.map((m) => mesDe(m.data)))
  set.add(mesDe(dataIsoDeMs(Date.now())))
  return [...set].sort().reverse()
}

export interface DadosLancamento {
  tipo: 'entrada' | 'saida'
  valor: number
  data: string
  categoria: string
  descricao: string
}

const frase = (d: Pick<DadosLancamento, 'tipo' | 'valor' | 'categoria' | 'descricao'>) =>
  `${d.tipo === 'entrada' ? 'entrada' : 'saída'} de ${reais(d.valor)} (${d.categoria}${d.descricao ? `: ${d.descricao}` : ''})`

export async function criarLancamento(d: DadosLancamento, autor: Autor) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'caixa', novoId()), {
    tipo: d.tipo,
    valor: d.valor,
    data: d.data,
    categoria: d.categoria,
    descricao: d.descricao,
    criadoPor: autor.uid,
    criadoPorNome: autor.nome,
    criadoEm: serverTimestamp(),
  })
  auditar(batch, { acao: 'caixa_lancamento', resumo: `Lançou no caixa uma ${frase(d)} em ${dataBr(d.data)}`, autor })
  await batch.commit()
}

export async function editarLancamento(antes: LancamentoCaixa, d: DadosLancamento, autor: Autor) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'caixa', antes.id), {
    tipo: d.tipo,
    valor: d.valor,
    data: d.data,
    categoria: d.categoria,
    descricao: d.descricao,
    editadoPor: autor.uid,
    editadoPorNome: autor.nome,
    editadoEm: serverTimestamp(),
  })
  auditar(batch, {
    acao: 'caixa_edicao',
    resumo: `Editou um lançamento do caixa: de ${frase({ ...antes, descricao: antes.descricao ?? '' })} em ${dataBr(antes.data)} para ${frase(d)} em ${dataBr(d.data)}`,
    autor,
  })
  await batch.commit()
}

export async function excluirLancamento(l: LancamentoCaixa, autor: Autor) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'caixa', l.id))
  auditar(batch, {
    acao: 'caixa_exclusao',
    resumo: `Excluiu do caixa uma ${frase({ ...l, descricao: l.descricao ?? '' })} de ${dataBr(l.data)}`,
    autor,
  })
  await batch.commit()
}

/** Publica (ou atualiza) o resumo do mês para os associados; só totais e categorias, nada de lançamento por lançamento. */
export async function publicarPrestacao(mes: string, r: ResumoDoMes, saldoAcumulado: number, autor: Autor) {
  const batch = writeBatch(db)
  const dados: Omit<PrestacaoContas, 'publicadoEm'> & { publicadoEm: unknown } = {
    mes,
    entradas: r.entradas,
    saidas: r.saidas,
    saldoMes: r.saldoMes,
    saldoAcumulado,
    entradasPorCategoria: r.entradasPorCategoria,
    saidasPorCategoria: r.saidasPorCategoria,
    publicadoPor: autor.uid,
    publicadoPorNome: autor.nome,
    publicadoEm: serverTimestamp(),
  }
  batch.set(doc(db, 'prestacaoContas', mes), dados)
  auditar(batch, { acao: 'caixa_publicacao', resumo: `Publicou aos associados a prestação de contas de ${rotuloDoMes(mes)}`, autor })
  await batch.commit()
}

export async function retirarPrestacao(mes: string, autor: Autor) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'prestacaoContas', mes))
  auditar(batch, { acao: 'caixa_publicacao', resumo: `Retirou dos associados a prestação de contas de ${rotuloDoMes(mes)}`, autor })
  await batch.commit()
}
