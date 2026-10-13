import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { reais } from '../../lib/credits'
import { baixarCsv } from '../../lib/csv'
import {
  CATEGORIAS_ENTRADA,
  CATEGORIAS_SAIDA,
  CAT_JOGOS_DINHEIRO,
  CAT_MENSALIDADES,
  criarLancamento,
  dataBr,
  dataIsoDeMs,
  doLancamento,
  editarLancamento,
  excluirLancamento,
  lerValor,
  mesDe,
  mesesComMovimento,
  movimentosAutomaticos,
  publicarPrestacao,
  resumir,
  retirarPrestacao,
  rotuloDoMes,
  saldoAte,
  type DadosLancamento,
} from '../../lib/caixa'
import { paraMillis } from '../../lib/status'
import type { Game, LancamentoCaixa, Participation, Payment, PrestacaoContas } from '../../types'

const hoje = () => dataIsoDeMs(Date.now())
const OUTRA = '__outra__'

function Kpi({ titulo, valor, cor, detalhe }: { titulo: string; valor: string; cor?: string; detalhe?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] uppercase tracking-widest text-mute/80">{titulo}</p>
      <p className={`mt-1 text-xl font-bold ${cor ?? 'text-ink'}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-mute">{detalhe}</p>}
    </div>
  )
}

const corDoSaldo = (n: number) => (n > 0 ? 'text-ok' : n < 0 ? 'text-danger' : 'text-ink')
const comSinal = (n: number) => `${n < 0 ? '−' : ''}${reais(Math.abs(n))}`

/** Admin e tesoureiro: entradas e saídas da associação, saldo do mês e do caixa, e a prestação de contas aos associados. */
export function AdminCaixa() {
  const { player: staff } = useAuth()
  const autor = staff ? { uid: staff.uid, nome: staff.nomeCompleto } : null

  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [presencas, setPresencas] = useState<Participation[]>([])
  const [jogos, setJogos] = useState<Game[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoCaixa[]>([])
  const [publicadas, setPublicadas] = useState<Record<string, PrestacaoContas>>({})
  const [mes, setMes] = useState(mesDe(hoje()))

  // formulário
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<LancamentoCaixa | null>(null)
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hoje())
  const [categoria, setCategoria] = useState(CATEGORIAS_SAIDA[0])
  const [categoriaLivre, setCategoriaLivre] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'payments'), (s) => setPagamentos(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment))),
      onSnapshot(query(collection(db, 'participations'), where('pagoCom', '==', 'dinheiro')), (s) =>
        setPresencas(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation)),
      ),
      onSnapshot(collection(db, 'games'), (s) => setJogos(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Game))),
      onSnapshot(query(collection(db, 'caixa'), orderBy('data', 'desc')), (s) => setLancamentos(s.docs.map((d) => ({ id: d.id, ...d.data() }) as LancamentoCaixa))),
      onSnapshot(collection(db, 'prestacaoContas'), (s) => {
        const m: Record<string, PrestacaoContas> = {}
        s.docs.forEach((d) => (m[d.id] = d.data() as PrestacaoContas))
        setPublicadas(m)
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  const automaticos = useMemo(() => movimentosAutomaticos(pagamentos, presencas, jogos), [pagamentos, presencas, jogos])
  const todos = useMemo(() => [...automaticos, ...lancamentos.map(doLancamento)], [automaticos, lancamentos])
  const meses = useMemo(() => mesesComMovimento(todos), [todos])
  const resumo = useMemo(() => resumir(todos, mes), [todos, mes])
  const saldoCaixa = useMemo(() => saldoAte(todos, mes), [todos, mes])

  const autoDoMes = useMemo(() => {
    const por = new Map<string, { valor: number; qtd: number }>()
    for (const m of automaticos) {
      if (mes !== 'todos' && mesDe(m.data) !== mes) continue
      const a = por.get(m.categoria) ?? { valor: 0, qtd: 0 }
      por.set(m.categoria, { valor: a.valor + m.valor, qtd: a.qtd + 1 })
    }
    return [...por.entries()]
  }, [automaticos, mes])

  const manuaisDoMes = useMemo(
    () => lancamentos.filter((l) => mes === 'todos' || mesDe(l.data) === mes),
    [lancamentos, mes],
  )

  const ultimosMeses = useMemo(
    () =>
      meses.slice(0, 6).map((m) => {
        const r = resumir(todos, m)
        return { mes: m, ...r }
      }),
    [meses, todos],
  )

  const publicada = mes !== 'todos' ? publicadas[mes] : undefined

  function abrirNovo() {
    setEditando(null)
    setTipo('saida')
    setValor('')
    setData(hoje())
    setCategoria(CATEGORIAS_SAIDA[0])
    setCategoriaLivre('')
    setDescricao('')
    setErro(null)
    setAberto(true)
  }

  function abrirEdicao(l: LancamentoCaixa) {
    const lista = l.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA
    setEditando(l)
    setTipo(l.tipo)
    setValor(String(l.valor).replace('.', ','))
    setData(l.data)
    if (lista.includes(l.categoria)) {
      setCategoria(l.categoria)
      setCategoriaLivre('')
    } else {
      setCategoria(OUTRA)
      setCategoriaLivre(l.categoria)
    }
    setDescricao(l.descricao ?? '')
    setErro(null)
    setAberto(true)
  }

  function trocarTipo(novo: 'entrada' | 'saida') {
    setTipo(novo)
    setCategoria((novo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA)[0])
    setCategoriaLivre('')
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!autor) return
    const v = lerValor(valor)
    const cat = (categoria === OUTRA ? categoriaLivre : categoria).trim()
    if (v == null) return setErro('Informe um valor maior que zero, por exemplo 25,00.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro('Informe a data.')
    if (!cat) return setErro('Informe a categoria.')
    if (cat === CAT_MENSALIDADES || cat === CAT_JOGOS_DINHEIRO) {
      return setErro('Essa categoria é somada sozinha pelo app; escolha outra para não contar duas vezes.')
    }
    const dados: DadosLancamento = { tipo, valor: v, data, categoria: cat.slice(0, 40), descricao: descricao.trim().slice(0, 200) }
    setOcupado(true)
    setErro(null)
    try {
      if (editando) await editarLancamento(editando, dados, autor)
      else await criarLancamento(dados, autor)
      setAberto(false)
      setEditando(null)
      setAviso(editando ? 'Lançamento atualizado.' : 'Lançamento registrado.')
      setMes(mesDe(data)) // mostra o mês do lançamento recém-feito
    } catch {
      setErro('Não consegui salvar. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  async function excluir(l: LancamentoCaixa) {
    if (!autor) return
    if (!window.confirm(`Excluir esta ${l.tipo === 'entrada' ? 'entrada' : 'saída'} de ${reais(l.valor)} (${l.categoria})? Fica registrado no histórico de ações.`)) return
    setErro(null)
    try {
      await excluirLancamento(l, autor)
      setAviso('Lançamento excluído.')
    } catch {
      setErro('Não consegui excluir. Tente de novo.')
    }
  }

  async function publicar() {
    if (!autor || mes === 'todos') return
    setOcupado(true)
    setErro(null)
    try {
      await publicarPrestacao(mes, resumo, saldoCaixa, autor)
      setAviso(`Prestação de contas de ${rotuloDoMes(mes)} publicada para os associados.`)
    } catch {
      setErro('Não consegui publicar. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  async function retirar() {
    if (!autor || mes === 'todos') return
    if (!window.confirm(`Retirar a prestação de contas de ${rotuloDoMes(mes)} da vista dos associados?`)) return
    try {
      await retirarPrestacao(mes, autor)
      setAviso('Prestação de contas retirada.')
    } catch {
      setErro('Não consegui retirar. Tente de novo.')
    }
  }

  function exportar() {
    const linhas: (string | number)[][] = []
    for (const l of manuaisDoMes) {
      linhas.push([dataBr(l.data), l.tipo === 'entrada' ? 'Entrada' : 'Saída', l.categoria, l.descricao ?? '', l.valor.toFixed(2).replace('.', ','), 'Lançamento', l.criadoPorNome])
    }
    for (const m of automaticos) {
      if (mes !== 'todos' && mesDe(m.data) !== mes) continue
      linhas.push([dataBr(m.data), 'Entrada', m.categoria, '', m.valor.toFixed(2).replace('.', ','), 'Automático', ''])
    }
    linhas.sort((a, b) => String(b[0]).split('/').reverse().join('').localeCompare(String(a[0]).split('/').reverse().join('')))
    baixarCsv(`caixa-${mes}.csv`, ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Origem', 'Lançado por'], linhas)
  }

  const categoriasDoTipo = tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA
  const nomeEntradas = Object.entries(resumo.entradasPorCategoria).sort((a, b) => b[1] - a[1])
  const nomeSaidas = Object.entries(resumo.saidasPorCategoria).sort((a, b) => b[1] - a[1])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Caixa da associação</h1>
          <p className="max-w-2xl text-xs text-mute">
            As mensalidades por Pix e os jogos pagos em dinheiro no check-in entram sozinhos. Lance aqui o resto: doações, patrocínios, campo, material, premiação e as demais
            despesas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="input w-auto" aria-label="Mês">
            <option value="todos">Todo o período</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {rotuloDoMes(m)}
              </option>
            ))}
          </select>
          <button type="button" onClick={exportar} className="btn-ghost">
            Exportar CSV
          </button>
          <button type="button" onClick={abrirNovo} className="btn-primary">
            + Novo lançamento
          </button>
        </div>
      </div>

      {aviso && <p className="mb-3 rounded-sm border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{aviso}</p>}
      {erro && !aberto && <p className="mb-3 text-sm text-danger">{erro}</p>}

      {aberto && (
        <form onSubmit={salvar} className="panel mb-6 space-y-3 p-4">
          <h2 className="text-sm font-bold text-ink">{editando ? 'Editar lançamento' : 'Novo lançamento'}</h2>
          <div className="flex gap-2">
            {(['saida', 'entrada'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => trocarTipo(t)}
                className={`flex-1 rounded-sm border px-3 py-2 text-sm font-semibold ${tipo === t ? (t === 'entrada' ? 'border-ok bg-ok/15 text-ok' : 'border-danger bg-danger/15 text-danger') : 'border-line text-mute'}`}
              >
                {t === 'entrada' ? 'Entrada' : 'Saída'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm text-mute">
              Valor (R$)
              <input required inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className="input mt-1" />
            </label>
            <label className="block text-sm text-mute">
              Data
              <input required type="date" value={data} onChange={(e) => setData(e.target.value)} className="input mt-1" />
            </label>
            <label className="block text-sm text-mute">
              Categoria
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input mt-1">
                {categoriasDoTipo.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={OUTRA}>Outra (digitar)...</option>
              </select>
            </label>
          </div>
          {categoria === OUTRA && (
            <input maxLength={40} placeholder="Nome da categoria" value={categoriaLivre} onChange={(e) => setCategoriaLivre(e.target.value)} className="input" />
          )}
          <input maxLength={200} placeholder="Descrição (opcional): o que foi, para quem, nota..." value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" />
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={ocupado} className="btn-primary">
              {ocupado ? 'Salvando...' : editando ? 'Salvar alterações' : 'Registrar'}
            </button>
            <button type="button" disabled={ocupado} onClick={() => setAberto(false)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Entradas" valor={reais(resumo.entradas)} cor="text-ok" detalhe={mes === 'todos' ? 'todo o período' : rotuloDoMes(mes)} />
        <Kpi titulo="Saídas" valor={reais(resumo.saidas)} cor="text-danger" detalhe={mes === 'todos' ? 'todo o período' : rotuloDoMes(mes)} />
        <Kpi titulo="Saldo do mês" valor={comSinal(resumo.saldoMes)} cor={corDoSaldo(resumo.saldoMes)} detalhe="entradas menos saídas" />
        <Kpi titulo="Saldo do caixa" valor={comSinal(saldoCaixa)} cor={corDoSaldo(saldoCaixa)} detalhe={mes === 'todos' ? 'hoje' : `até o fim de ${rotuloDoMes(mes).toLowerCase()}`} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Movimento {mes === 'todos' ? 'de todo o período' : `de ${rotuloDoMes(mes)}`}</h2>
          <div className="space-y-2">
            {autoDoMes.map(([cat, a]) => (
              <div key={cat} className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface2 px-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-ink">{cat}</span>
                  <span className="block text-[11px] text-mute">
                    soma automática · {a.qtd} {a.qtd === 1 ? 'registro' : 'registros'}
                  </span>
                </span>
                <b className="shrink-0 text-ok">+{reais(a.valor)}</b>
              </div>
            ))}
            {manuaisDoMes.map((l) => (
              <div key={l.id} className="rounded-sm border border-line bg-surface2 px-4 py-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-ink">
                      {l.categoria}
                      {l.descricao ? <span className="text-mute"> · {l.descricao}</span> : null}
                    </span>
                    <span className="block text-[11px] text-mute">
                      {dataBr(l.data)} · lançado por {l.criadoPorNome}
                      {l.editadoPorNome ? ` · editado por ${l.editadoPorNome}` : ''}
                    </span>
                  </span>
                  <b className={`shrink-0 ${l.tipo === 'entrada' ? 'text-ok' : 'text-danger'}`}>
                    {l.tipo === 'entrada' ? '+' : '−'}
                    {reais(l.valor)}
                  </b>
                </div>
                <div className="mt-1 flex gap-3 text-[11px]">
                  <button type="button" onClick={() => abrirEdicao(l)} className="text-mute underline hover:text-ink">
                    Editar
                  </button>
                  <button type="button" onClick={() => excluir(l)} className="text-danger underline">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {autoDoMes.length === 0 && manuaisDoMes.length === 0 && <p className="text-sm text-mute/70">Nada lançado neste período.</p>}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">Por categoria</h2>
            {nomeEntradas.length === 0 && nomeSaidas.length === 0 && <p className="text-xs text-mute/70">Sem movimento.</p>}
            {nomeEntradas.length > 0 && (
              <>
                <p className="text-[11px] uppercase tracking-widest text-mute/80">Entradas</p>
                <ul className="mb-3 mt-1 space-y-0.5 text-xs">
                  {nomeEntradas.map(([c, v]) => (
                    <li key={c} className="flex justify-between gap-2 text-mute">
                      <span className="truncate">{c}</span>
                      <b className="text-ok">{reais(v)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {nomeSaidas.length > 0 && (
              <>
                <p className="text-[11px] uppercase tracking-widest text-mute/80">Saídas</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {nomeSaidas.map(([c, v]) => (
                    <li key={c} className="flex justify-between gap-2 text-mute">
                      <span className="truncate">{c}</span>
                      <b className="text-danger">{reais(v)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="mb-1 text-sm font-bold text-ink">Prestação de contas aos associados</h2>
            <p className="text-xs text-mute">
              Mostra aos associados (na página Histórico) só os totais do mês e por categoria, sem os lançamentos um a um. Você escolhe quando publicar.
            </p>
            {mes === 'todos' ? (
              <p className="mt-2 text-xs text-mute/70">Escolha um mês para publicar.</p>
            ) : publicada ? (
              <>
                <p className="mt-2 text-xs text-ok">
                  Publicada por {publicada.publicadoPorNome}
                  {paraMillis(publicada.publicadoEm) ? ` em ${new Date(paraMillis(publicada.publicadoEm)!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={ocupado} onClick={publicar} className="btn-ghost">
                    Atualizar com os números de agora
                  </button>
                  <button type="button" onClick={retirar} className="btn-ghost text-danger">
                    Retirar
                  </button>
                </div>
              </>
            ) : (
              <button type="button" disabled={ocupado} onClick={publicar} className="btn-primary mt-3 w-full">
                Publicar {rotuloDoMes(mes)}
              </button>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">Últimos meses</h2>
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase text-mute">
                <tr>
                  <th className="py-1">Mês</th>
                  <th className="py-1 text-right">Entr.</th>
                  <th className="py-1 text-right">Saíd.</th>
                  <th className="py-1 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {ultimosMeses.map((m) => (
                  <tr key={m.mes} className="border-t border-line">
                    <td className="py-1 text-mute">{`${m.mes.slice(5, 7)}/${m.mes.slice(0, 4)}`}</td>
                    <td className="py-1 text-right text-ok">{m.entradas.toFixed(0)}</td>
                    <td className="py-1 text-right text-danger">{m.saidas.toFixed(0)}</td>
                    <td className={`py-1 text-right font-semibold ${corDoSaldo(m.saldoMes)}`}>{m.saldoMes.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-mute/70">valores em reais, arredondados</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
