import { useMemo, useState } from 'react'
import { formatarCreditos, type Autor } from '../lib/credits'
import { estornarPagamento, planejarEstorno, type PlanoDeEstorno } from '../lib/payments'
import { formatarData, paraMillis } from '../lib/status'
import type { Payment } from '../types'

const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
/** "07/10/2026 às 14:32" */
const dataEHora = (ms: number | null) => (ms ? `${formatarData(ms)} às ${hora(ms)}` : 'data não registrada')
/** minúsculas e sem acento, para a busca achar "joao" em "João" */
const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Mês do pagamento ("2026-10"): é o mês em que o dinheiro entrou, o que vale para conferir com o extrato do banco. */
function chaveDoMes(p: Payment) {
  const ms = paraMillis(p.dataPagamento)
  if (ms == null) return null
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function rotuloDoMes(chave: string) {
  const [a, m] = chave.split('-').map(Number)
  const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const PASSO = 20

/**
 * Histórico das baixas: quem deu a baixa e quando, filtro por mês e por nome, e o estorno de uma baixa dada
 * indevidamente (fica registrado com quem estornou, quando e o motivo).
 */
export function HistoricoBaixas({ payments, autor }: { payments: Payment[]; autor: Autor | null }) {
  const [busca, setBusca] = useState('')
  const [mes, setMes] = useState('todos')
  const [situacao, setSituacao] = useState<'todas' | 'confirmado' | 'estornado'>('todas')
  const [limite, setLimite] = useState(PASSO)

  const [estornandoId, setEstornandoId] = useState<string | null>(null)
  const [plano, setPlano] = useState<PlanoDeEstorno | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const baixas = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'confirmado' || p.status === 'estornado')
        .sort((a, b) => (paraMillis(b.confirmadoEm) ?? paraMillis(b.dataPagamento) ?? 0) - (paraMillis(a.confirmadoEm) ?? paraMillis(a.dataPagamento) ?? 0)),
    [payments],
  )

  const meses = useMemo(() => [...new Set(baixas.map(chaveDoMes).filter((c): c is string => c != null))].sort().reverse(), [baixas])

  const filtradas = useMemo(() => {
    const q = simples(busca)
    return baixas.filter(
      (p) =>
        (mes === 'todos' || chaveDoMes(p) === mes) &&
        (situacao === 'todas' || p.status === situacao) &&
        (q === '' || simples(p.jogadorNome).includes(q) || simples(p.txid).includes(q)),
    )
  }, [baixas, busca, mes, situacao])

  const confirmadas = filtradas.filter((p) => p.status === 'confirmado')
  const estornadas = filtradas.length - confirmadas.length
  const total = confirmadas.reduce((s, p) => s + p.valor, 0)
  const filtrando = busca.trim() !== '' || mes !== 'todos' || situacao !== 'todas'

  function limpar() {
    setBusca('')
    setMes('todos')
    setSituacao('todas')
    setLimite(PASSO)
  }

  async function abrirEstorno(p: Payment) {
    setEstornandoId(p.id)
    setPlano(null)
    setMotivo('')
    setErro(null)
    setAviso(null)
    try {
      setPlano(await planejarEstorno(p))
    } catch (e) {
      setErro((e as Error).message)
      setEstornandoId(null)
    }
  }

  function fecharEstorno() {
    setEstornandoId(null)
    setPlano(null)
    setMotivo('')
  }

  async function confirmarEstorno(p: Payment) {
    if (!autor) return
    setOcupado(true)
    setErro(null)
    try {
      const r = await estornarPagamento(p, motivo, autor)
      setAviso(
        `Baixa de ${p.jogadorNome} estornada (${reais(p.valor)}).` +
          (r.creditosRetirados < r.creditosGerados
            ? ` Só ${formatarCreditos(r.creditosRetirados)} dos ${formatarCreditos(r.creditosGerados)} créditos puderam ser retirados, porque o jogador já tinha usado o resto.`
            : ''),
      )
      fecharEstorno()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-ink">Baixas</h2>
      <p className="mb-3 text-xs text-mute">
        Cada baixa guarda quem a deu, o dia e a hora. Se uma baixa foi dada por engano, use "Estornar baixa".
      </p>

      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input
          type="search"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setLimite(PASSO)
          }}
          className="input"
        />
        <select
          value={mes}
          onChange={(e) => {
            setMes(e.target.value)
            setLimite(PASSO)
          }}
          className="input"
          aria-label="Mês do pagamento"
        >
          <option value="todos">Todos os meses</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {rotuloDoMes(m)}
            </option>
          ))}
        </select>
        <select
          value={situacao}
          onChange={(e) => {
            setSituacao(e.target.value as typeof situacao)
            setLimite(PASSO)
          }}
          className="input"
          aria-label="Situação"
        >
          <option value="todas">Todas</option>
          <option value="confirmado">Confirmadas</option>
          <option value="estornado">Estornadas</option>
        </select>
      </div>

      <p className="mb-3 text-xs text-mute">
        {situacao === 'estornado' ? (
          <>
            <b className="text-danger">{estornadas}</b> {estornadas === 1 ? 'baixa estornada' : 'baixas estornadas'}
          </>
        ) : (
          <>
            <b className="text-ink">{confirmadas.length}</b> {confirmadas.length === 1 ? 'baixa' : 'baixas'} · total{' '}
            <b className="text-ok">{reais(total)}</b>
            {estornadas > 0 && <span className="text-danger"> · {estornadas} estornada(s) fora da soma</span>}
          </>
        )}
        {filtrando && (
          <button type="button" onClick={limpar} className="ml-2 underline hover:text-ink">
            limpar filtros
          </button>
        )}
      </p>

      {aviso && <p className="mb-3 rounded-sm border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{aviso}</p>}
      {erro && <p className="mb-3 text-sm text-danger">{erro}</p>}

      {filtradas.length === 0 && <p className="text-sm text-mute/70">{baixas.length === 0 ? 'Nenhuma baixa ainda.' : 'Nenhuma baixa com esses filtros.'}</p>}

      <div className="space-y-2">
        {filtradas.slice(0, limite).map((p) => {
          const estornada = p.status === 'estornado'
          const confirmadoMs = paraMillis(p.confirmadoEm)
          const estornoMs = paraMillis(p.estornadoEm)
          return (
            <div key={p.id} className={`rounded-sm border px-4 py-3 text-sm ${estornada ? 'border-danger/30 bg-danger/5' : 'border-line bg-surface2'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-medium ${estornada ? 'text-mute line-through' : 'text-ink'}`}>
                    {p.jogadorNome} <span className="font-normal text-mute">· {reais(p.valor)}</span>
                  </p>
                  <p className="text-xs text-mute">pago em {formatarData(paraMillis(p.dataPagamento))}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estornada ? 'border-danger/40 bg-danger/15 text-danger' : 'border-ok/40 bg-ok/15 text-ok'}`}
                  >
                    {estornada ? 'Estornada' : 'Confirmada'}
                  </span>
                  {!estornada && estornandoId !== p.id && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => abrirEstorno(p)}
                      className="rounded-sm border border-danger/40 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      Estornar baixa
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-1 text-[11px] text-mute">
                Baixa dada por <b className="text-ink">{p.confirmadoPorNome ?? 'quem não foi registrado'}</b> em {dataEHora(confirmadoMs)}
              </p>
              {estornada && (
                <p className="mt-0.5 text-[11px] text-danger">
                  Estornada por <b>{p.estornadoPorNome ?? 'quem não foi registrado'}</b> em {dataEHora(estornoMs)}
                  {p.estornoMotivo ? `. Motivo: ${p.estornoMotivo}` : ''}
                </p>
              )}
              <p className="mt-0.5 break-all font-mono text-[10px] text-mute/60">{p.txid}</p>

              {estornandoId === p.id && (
                <div className="mt-3 space-y-2 rounded-sm border border-danger/40 bg-danger/5 p-3 text-xs">
                  <p className="font-semibold text-danger">Estornar esta baixa?</p>
                  {!plano ? (
                    <p className="text-mute">Calculando o que muda...</p>
                  ) : (
                    <ul className="list-disc space-y-0.5 pl-4 text-mute">
                      <li>
                        Vencimento: {formatarData(plano.vencimentoAtual)} → {plano.vencimentoNovo ? formatarData(plano.vencimentoNovo) : 'sem vencimento'}.
                      </li>
                      <li>
                        Créditos: retira {formatarCreditos(plano.creditosRetirados)} de {formatarCreditos(plano.creditosGerados)} da carteira
                        {plano.creditosRetirados < plano.creditosGerados && (
                          <b className="text-warn"> (o jogador só tem {formatarCreditos(plano.saldo)}: o resto já foi usado)</b>
                        )}
                        .
                      </li>
                      <li>A mensalidade sai da contagem do jogador. Conquistas que ela já rendeu não são retiradas (o admin remove em Jogadores).</li>
                    </ul>
                  )}
                  <input
                    maxLength={200}
                    placeholder="Motivo do estorno (obrigatório)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="input"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={ocupado || !plano || motivo.trim().length < 3}
                      onClick={() => confirmarEstorno(p)}
                      className="rounded-sm bg-danger px-4 py-2 text-sm font-semibold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {ocupado ? 'Estornando...' : 'Confirmar estorno'}
                    </button>
                    <button type="button" disabled={ocupado} onClick={fecharEstorno} className="btn-ghost">
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtradas.length > limite && (
        <button type="button" onClick={() => setLimite((l) => l + PASSO)} className="mt-2 text-xs text-mute underline hover:text-ink">
          Mostrar mais ({filtradas.length - limite} restantes)
        </button>
      )}
    </section>
  )
}
