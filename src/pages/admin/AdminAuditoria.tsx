import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { GRUPOS_AUDITORIA, ROTULO_ACAO, type AcaoAuditoria, type GrupoAuditoria } from '../../lib/auditoria'
import { rotuloDoMes } from '../../lib/caixa'
import { formatarData, paraMillis } from '../../lib/status'
import type { RegistroDeAcao } from '../../types'

const PASSO = 100

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const grupoDa = (acao: string) => GRUPOS_AUDITORIA.find((g) => g.acoes.includes(acao as AcaoAuditoria))?.id ?? 'pessoas'
const COR_DO_GRUPO: Record<GrupoAuditoria, string> = {
  dinheiro: 'border-gold/40 bg-gold/15 text-gold',
  pessoas: 'border-accent-hi/40 bg-accent/15 text-accent-hi',
  jogos: 'border-ok/40 bg-ok/15 text-ok',
}

const mesDoRegistro = (r: RegistroDeAcao) => {
  const ms = paraMillis(r.criadoEm)
  if (ms == null) return null
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Só o admin: o que a diretoria fez no app (baixas, estornos, ajustes, exclusões, cargos...), quem fez e quando. */
export function AdminAuditoria() {
  const [registros, setRegistros] = useState<RegistroDeAcao[] | null>(null)
  const [limite, setLimite] = useState(PASSO)
  const [grupo, setGrupo] = useState<GrupoAuditoria | 'todos'>('todos')
  const [quem, setQuem] = useState('todos')
  const [mes, setMes] = useState('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'auditoria'), orderBy('criadoEm', 'desc'), limit(limite))
    return onSnapshot(q, (snap) => setRegistros(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegistroDeAcao)))
  }, [limite])

  const pessoas = useMemo(() => [...new Set((registros ?? []).map((r) => r.porNome))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [registros])
  const meses = useMemo(() => [...new Set((registros ?? []).map(mesDoRegistro).filter((m): m is string => m != null))].sort().reverse(), [registros])

  const filtrados = useMemo(() => {
    const q = simples(busca)
    return (registros ?? []).filter(
      (r) =>
        (grupo === 'todos' || grupoDa(r.acao) === grupo) &&
        (quem === 'todos' || r.porNome === quem) &&
        (mes === 'todos' || mesDoRegistro(r) === mes) &&
        (q === '' || simples(`${r.resumo} ${r.alvoNome ?? ''} ${r.porNome}`).includes(q)),
    )
  }, [registros, grupo, quem, mes, busca])

  const cheio = registros !== null && registros.length >= limite

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Histórico de ações</h1>
      <p className="mb-4 max-w-2xl text-xs text-mute">
        O que a diretoria fez pelo app: baixas e estornos de Pix, ajustes de créditos, caixa, exclusões, cargos, edições de ficha e conquistas. Os registros não se editam nem se
        apagam. Quem mexe direto no console do Firebase não aparece aqui.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {([['todos', 'Tudo'], ...GRUPOS_AUDITORIA.map((g) => [g.id, g.rotulo] as const)] as readonly (readonly [string, string])[]).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGrupo(id as GrupoAuditoria | 'todos')}
            className={`rounded-full border px-3 py-1 ${grupo === id ? 'border-accent-hi bg-accent/15 text-ink' : 'border-line text-mute hover:bg-surface2'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input type="search" placeholder="Buscar por nome ou texto..." value={busca} onChange={(e) => setBusca(e.target.value)} className="input" />
        <select value={quem} onChange={(e) => setQuem(e.target.value)} className="input" aria-label="Quem fez">
          <option value="todos">Quem fez: todos</option>
          {pessoas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={mes} onChange={(e) => setMes(e.target.value)} className="input" aria-label="Mês">
          <option value="todos">Todos os meses</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {rotuloDoMes(m)}
            </option>
          ))}
        </select>
      </div>

      {registros === null && <p className="text-sm text-mute">Carregando...</p>}
      {registros && filtrados.length === 0 && (
        <p className="text-sm text-mute/70">{registros.length === 0 ? 'Nenhuma ação registrada ainda.' : 'Nenhum registro com esses filtros.'}</p>
      )}

      <div className="space-y-2">
        {filtrados.map((r) => {
          const ms = paraMillis(r.criadoEm)
          const g = grupoDa(r.acao)
          return (
            <div key={r.id} className="rounded-sm border border-line bg-surface2 px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${COR_DO_GRUPO[g]}`}>{ROTULO_ACAO[r.acao as AcaoAuditoria] ?? r.acao}</span>
                <span className="text-[11px] text-mute">
                  {ms ? `${formatarData(ms)} às ${new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'agora'}
                </span>
              </div>
              <p className="mt-1 text-ink">{r.resumo}</p>
              <p className="mt-0.5 text-[11px] text-mute">
                por <b className="text-ink">{r.porNome}</b>
                {r.alvoNome && r.alvoNome !== r.porNome ? ` · jogador: ${r.alvoNome}` : ''}
              </p>
            </div>
          )
        })}
      </div>

      {cheio && (
        <button type="button" onClick={() => setLimite((l) => l + PASSO)} className="mt-3 text-xs text-mute underline hover:text-ink">
          Mostrar registros mais antigos
        </button>
      )}
    </div>
  )
}
