import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { reais } from '../../lib/credits'
import { baixarCsv } from '../../lib/csv'
import { DIA_MS, STATUS_LABELS, formatarData, paraMillis, statusEfetivo } from '../../lib/status'
import type { Game, JogadorResumo, Participation, Payment, PlayerStatus, Player, Team } from '../../types'

interface Cartao extends JogadorResumo {
  status: PlayerStatus
  vencimento: number | null
}

function Kpi({ titulo, valor, detalhe, cor }: { titulo: string; valor: string | number; detalhe?: string; cor?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] uppercase tracking-widest text-mute/80">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${cor ?? 'text-ink'}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-mute">{detalhe}</p>}
    </div>
  )
}

function Barra({ rotulo, valor, max, texto }: { rotulo: string; valor: number; max: number; texto: string }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 shrink-0 text-mute">{rotulo}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-sm bg-surface2">
        <div className="h-full bg-accent" style={{ width: `${max > 0 ? Math.max(2, (valor / max) * 100) : 0}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-ink">{texto}</span>
    </div>
  )
}

export function AdminPanel() {
  const { player: staff } = useAuth()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [parts, setParts] = useState<Participation[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'publicCards'), (s) => setCartoes(s.docs.map((d) => ({ uid: d.id, ...d.data() }) as Cartao))),
      onSnapshot(collection(db, 'payments'), (s) => setPayments(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment))),
      onSnapshot(collection(db, 'games'), (s) => setGames(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Game))),
      onSnapshot(collection(db, 'participations'), (s) => setParts(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation))),
      onSnapshot(collection(db, 'teams'), (s) => setTeams(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Team))),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  const resumo = useMemo(() => {
    const agora = Date.now()
    const por: Record<PlayerStatus, number> = { pago: 0, inadimplente: 0, inativo: 0 }
    let vencendo = 0
    for (const c of cartoes) {
      const s = statusEfetivo(c)
      por[s]++
      if (s === 'pago' && c.vencimento != null && c.vencimento - agora <= 7 * DIA_MS) vencendo++
    }
    const ativos = por.pago + por.inadimplente
    return { por, vencendo, total: cartoes.length, inadimplencia: ativos ? Math.round((por.inadimplente / ativos) * 100) : 0 }
  }, [cartoes])

  const meses = useMemo(() => {
    const hoje = new Date()
    const lista = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1)
      return { chave: `${d.getFullYear()}-${d.getMonth()}`, rotulo: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), total: 0, qtd: 0 }
    })
    for (const p of payments) {
      if (p.status !== 'confirmado') continue
      const ms = paraMillis(p.dataPagamento)
      if (ms == null) continue
      const d = new Date(ms)
      const m = lista.find((x) => x.chave === `${d.getFullYear()}-${d.getMonth()}`)
      if (m) {
        m.total += p.valor
        m.qtd++
      }
    }
    return lista
  }, [payments])

  const jogos = useMemo(() => {
    return [...games]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 6)
      .map((g) => {
        const doJogo = parts.filter((p) => p.gameId === g.id && (p.status === 'ativa' || p.status === 'presente'))
        const presentes = doJogo.filter((p) => p.status === 'presente').length
        return { g, inscritos: doJogo.length, presentes }
      })
  }, [games, parts])

  const porTime = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cartoes) if (c.timeId) m.set(c.timeId, (m.get(c.timeId) ?? 0) + 1)
    return teams.map((t) => ({ t, n: m.get(t.id) ?? 0 })).sort((a, b) => b.n - a.n)
  }, [cartoes, teams])

  const maxMes = Math.max(...meses.map((m) => m.total), 0)
  const mesAtual = meses[meses.length - 1]

  function exportarPagamentos() {
    baixarCsv(
      `pagamentos-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Data do pagamento', 'Jogador', 'Valor (R$)', 'Créditos gerados', 'Situação', 'Identificador Pix'],
      [...payments]
        .sort((a, b) => (paraMillis(b.dataPagamento) ?? 0) - (paraMillis(a.dataPagamento) ?? 0))
        .map((p) => [
          p.dataPagamento ? formatarData(paraMillis(p.dataPagamento)) : '',
          p.jogadorNome,
          p.valor.toFixed(2).replace('.', ','),
          p.creditosGerados ?? '',
          p.status === 'confirmado' ? 'Confirmado' : 'Pendente',
          p.txid,
        ]),
    )
  }

  function exportarPresenca() {
    const gamePorId = new Map(games.map((g) => [g.id, g]))
    baixarCsv(
      `presenca-por-jogo-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Jogo', 'Data', 'Jogador', 'Situação', 'Pagamento', 'Créditos debitados', 'Check-in por'],
      [...parts]
        .filter((p) => p.status !== 'removida')
        .sort((a, b) => (gamePorId.get(b.gameId)?.data ?? '').localeCompare(gamePorId.get(a.gameId)?.data ?? ''))
        .map((p) => [
          p.gameNome,
          gamePorId.get(p.gameId)?.data ?? '',
          p.jogadorNome,
          p.status === 'presente' ? 'Presente' : p.status === 'espera' ? 'Lista de espera' : 'Inscrito',
          p.pagoCom === 'creditos' ? 'Créditos' : p.pagoCom === 'dinheiro' ? 'Dinheiro' : '',
          p.creditosDebitados,
          p.checkInPorNome ?? '',
        ]),
    )
  }

  async function exportarAssociados() {
    if (!window.confirm('Esta planilha contém dados pessoais dos associados (LGPD). Guarde com cuidado. Continuar?')) return
    setExportando(true)
    try {
      const snap = await getDocs(collection(db, 'players'))
      const jogadores = snap.docs.map((d) => d.data() as Player).sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto))
      baixarCsv(
        `associados-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Nome', 'E-mail', 'Celular', 'Nascimento', 'Time', 'Situação', 'Vencimento', 'Cadastro em', 'Termo aceito (versão)'],
        jogadores.map((p) => [
          p.nomeCompleto,
          p.email,
          p.celular,
          p.dataNascimento,
          p.timeAprovado ? p.timeNome : '',
          STATUS_LABELS[statusEfetivo(p)],
          formatarData(p.vencimento),
          formatarData(paraMillis(p.criadoEm)),
          p.aceiteTermosVersao ?? '',
        ]),
      )
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Painel e relatórios</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi titulo="Associados" valor={resumo.total} detalhe={`${resumo.por.inativo} inativos`} />
        <Kpi titulo="Em dia" valor={resumo.por.pago} detalhe={`${resumo.vencendo} vencem em 7 dias`} cor="text-ok" />
        <Kpi titulo="Inadimplentes" valor={resumo.por.inadimplente} detalhe={`${resumo.inadimplencia}% dos ativos`} cor="text-warn" />
        <Kpi titulo="Receita do mês" valor={reais(mesAtual?.total ?? 0)} detalhe={`${mesAtual?.qtd ?? 0} pagamentos`} cor="text-gold" />
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Receita dos últimos 6 meses</h2>
          <div className="space-y-2">
            {meses.map((m) => (
              <Barra key={m.chave} rotulo={m.rotulo} valor={m.total} max={maxMes} texto={reais(m.total)} />
            ))}
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Presença nos últimos jogos</h2>
          <div className="space-y-2">
            {jogos.length === 0 && <p className="text-sm text-mute/70">Nenhum jogo ainda.</p>}
            {jogos.map(({ g, inscritos, presentes }) => (
              <div key={g.id}>
                <p className="mb-0.5 truncate text-xs text-ink">
                  {g.nome} <span className="text-mute">({new Date(g.data + 'T12:00').toLocaleDateString('pt-BR')})</span>
                </p>
                <Barra rotulo="" valor={presentes} max={Math.max(inscritos, 1)} texto={`${presentes}/${inscritos}`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel mb-8 p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Membros por time</h2>
        {porTime.length === 0 && <p className="text-sm text-mute/70">Nenhum time cadastrado.</p>}
        <div className="space-y-2">
          {porTime.map(({ t, n }) => (
            <Barra key={t.id} rotulo={t.nome.slice(0, 10)} valor={n} max={Math.max(...porTime.map((x) => x.n), 1)} texto={`${n} membros`} />
          ))}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink">Exportar planilhas (CSV)</h2>
        <p className="mb-3 text-xs text-mute">Abrem no Excel ou Google Planilhas. Úteis para a prestação de contas da associação.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportarPagamentos} className="btn-primary">
            Pagamentos
          </button>
          <button onClick={exportarPresenca} className="btn-primary">
            Presença por jogo
          </button>
          {staff?.role === 'admin' && (
            <button onClick={exportarAssociados} disabled={exportando} className="btn-ghost">
              {exportando ? 'Gerando...' : 'Associados (dados pessoais)'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
