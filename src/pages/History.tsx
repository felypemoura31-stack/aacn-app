import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { formatarCreditos, reais } from '../lib/credits'
import { formatarData, paraMillis } from '../lib/status'
import { GRUPOS } from '../lib/conquistas'
import { IconeConquista } from '../components/IconeConquista'
import { useConquistas } from '../contexts/ConquistasContext'
import type { Game, LedgerEntry, Participation, Payment } from '../types'

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] uppercase tracking-widest text-mute/80">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-mute">{detalhe}</p>}
    </div>
  )
}

export function History() {
  const { player } = useAuth()
  const [parts, setParts] = useState<Participation[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const { conquistas, contexto, bonusRecebido } = useConquistas()

  useEffect(() => {
    if (!player) return
    const meu = where('uid', '==', player.uid)
    const unsubs = [
      onSnapshot(query(collection(db, 'participations'), meu), (s) => setParts(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation))),
      onSnapshot(collection(db, 'games'), (s) => setGames(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Game))),
      onSnapshot(query(collection(db, 'payments'), meu), (s) => setPayments(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment))),
      onSnapshot(query(collection(db, 'ledger'), meu), (s) => setLedger(s.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry))),
    ]
    return () => unsubs.forEach((u) => u())
  }, [player])

  const dados = useMemo(() => {
    const gamePorId = new Map(games.map((g) => [g.id, g]))
    const hoje = new Date().toISOString().slice(0, 10)
    const jogados = parts
      .filter((p) => p.status === 'presente')
      .map((p) => ({ p, g: gamePorId.get(p.gameId) }))
      .sort((a, b) => (b.g?.data ?? '').localeCompare(a.g?.data ?? ''))
    // inscrito, o jogo já passou e nunca fez check-in = falta
    const faltas = parts.filter((p) => p.status === 'ativa' && (gamePorId.get(p.gameId)?.data ?? '9999') < hoje).length
    const presentes = jogados.length
    const frequencia = presentes + faltas > 0 ? Math.round((presentes / (presentes + faltas)) * 100) : null

    const pagas = payments.filter((p) => p.status === 'confirmado')
    const totalPago = pagas.reduce((s, p) => s + p.valor, 0)
    const recebidos = ledger.filter((l) => l.tipo === 'pagamento' && l.creditos > 0).reduce((s, l) => s + l.creditos, 0)
    const usados = Math.max(0, -ledger.filter((l) => l.tipo === 'jogo' || l.tipo === 'estorno').reduce((s, l) => s + l.creditos, 0))
    return { jogados, presentes, faltas, frequencia, pagas: pagas.length, totalPago, recebidos, usados }
  }, [parts, games, payments, ledger])

  if (!player) return null

  const desde = paraMillis(player.criadoEm)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Meu histórico</h1>
      <p className="mb-4 text-sm text-mute">Associado desde {formatarData(desde)}.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi titulo="Jogos jogados" valor={dados.presentes} />
        <Kpi titulo="Frequência" valor={dados.frequencia === null ? '—' : `${dados.frequencia}%`} detalhe={dados.faltas ? `${dados.faltas} falta(s)` : 'sem faltas'} />
        <Kpi titulo="Mensalidades" valor={dados.pagas} detalhe={reais(dados.totalPago)} />
        <Kpi titulo="Créditos usados" valor={formatarCreditos(dados.usados)} detalhe={`${formatarCreditos(dados.recebidos)} recebidos`} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="panel p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">
              Conquistas <span className="font-normal text-mute">({conquistas.filter((c) => c.resgatada).length}/{conquistas.length})</span>
            </h2>
            <p className="text-xs text-mute">
              Bônus recebidos: <span className="font-semibold text-gold">{formatarCreditos(bonusRecebido)} créditos</span>
            </p>
          </div>
          {GRUPOS.map((g) => (
            <div key={g.id} className="mt-4 first:mt-0">
              <h3 className="mb-1 text-[11px] uppercase tracking-widest text-mute/80">{g.titulo}</h3>
              <ul className="divide-y divide-line">
                {conquistas
                  .filter((c) => c.grupo === g.id)
                  .map((c) => {
                    const atual = c.campo ? contexto[c.campo] : null
                    const feita = c.resgatada || c.atingida
                    return (
                      <li key={c.id} className={`flex items-center justify-between gap-3 py-2 ${feita ? '' : 'opacity-60'}`} title={c.desc}>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                            <IconeConquista id={c.id} tamanho={22} apagado={!feita} className="shrink-0" />
                            <span className="truncate">{c.titulo}</span>
                          </p>
                          <p className="truncate text-[11px] text-mute">
                            {c.desc}
                            {!c.atingida && !c.resgatada && c.meta != null && atual != null ? ` · ${Math.min(atual, c.meta)}/${c.meta}` : ''}
                          </p>
                        </div>
                        <p className={`shrink-0 text-xs font-semibold ${c.resgatada ? 'text-ok' : c.atingida ? 'text-gold' : 'text-mute'}`}>
                          {c.resgatada
                            ? c.pago > 0
                              ? `+${formatarCreditos(c.pago)}`
                              : '✓'
                            : c.atingida
                              ? 'Creditando...'
                              : `+${formatarCreditos(c.bonus)}`}
                        </p>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
          <p className="mt-4 text-[11px] text-mute/70">Cada conquista paga um bônus único em créditos, que cai sozinho na carteira.</p>
        </section>

        <section>
      <h2 className="mb-2 text-sm font-bold text-ink">Jogos que você jogou</h2>
      <div className="space-y-2">
        {dados.jogados.length === 0 && <p className="text-sm text-mute/70">Você ainda não tem presença registrada.</p>}
        {dados.jogados.map(({ p, g }) => (
          <div key={p.id} className="flex justify-between rounded-sm border border-line bg-surface2 px-4 py-2 text-sm">
            <span className="text-ink">
              {p.gameNome} <span className="text-mute">{g ? `· ${new Date(g.data + 'T12:00').toLocaleDateString('pt-BR')}` : ''}</span>
            </span>
            <span className="text-mute">{p.pagoCom === 'creditos' ? `${formatarCreditos(p.creditosDebitados)} créditos` : 'dinheiro'}</span>
          </div>
        ))}
      </div>
        </section>
      </div>
    </div>
  )
}
