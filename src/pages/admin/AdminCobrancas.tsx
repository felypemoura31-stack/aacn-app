import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { reais } from '../../lib/credits'
import { DIA_MS, STATUS_COLORS, STATUS_LABELS, formatarData, paraMillis, statusEfetivo } from '../../lib/status'
import { linkWhatsapp } from '../../lib/whatsapp'
import { useContatos } from '../../lib/useContatos'
import type { PixConfig, PlayerStatus } from '../../types'

interface Cartao {
  uid: string
  nomeCompleto: string
  timeNome: string | null
  status: PlayerStatus
  vencimento: number | null
}

function mensagem(c: Cartao, valor: number | null) {
  const primeiro = c.nomeCompleto.split(' ')[0]
  const efetivo = statusEfetivo(c)
  const quando =
    c.vencimento == null
      ? 'ainda não foi paga'
      : efetivo === 'pago'
        ? `vence em ${formatarData(c.vencimento)}`
        : `venceu em ${formatarData(c.vencimento)}`
  const v = valor ? ` (${reais(valor)})` : ''
  return `Olá, ${primeiro}! Aqui é da AACN. Sua mensalidade${v} ${quando}. Para pagar, abra o app (${window.location.origin}), vá em Minha carteirinha > Mensalidade e gere o Pix. Qualquer dúvida é só responder aqui. Obrigado!`
}

export function AdminCobrancas() {
  const { player: staff } = useAuth()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const contatos = useContatos(staff?.role === 'admin')
  const [cobradas, setCobradas] = useState<Record<string, { ultimaEm: unknown; porNome: string }>>({})
  const [cfg, setCfg] = useState<PixConfig | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'vencidos' | 'vencendo'>('todos')

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'publicCards'), (snap) =>
      setCartoes(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Cartao)),
    )
    const u3 = onSnapshot(collection(db, 'cobrancas'), (snap) => {
      const m: Record<string, { ultimaEm: unknown; porNome: string }> = {}
      snap.docs.forEach((d) => (m[d.id] = d.data() as { ultimaEm: unknown; porNome: string }))
      setCobradas(m)
    })
    const u4 = onSnapshot(doc(db, 'config', 'pix'), (snap) => setCfg(snap.exists() ? (snap.data() as PixConfig) : null))
    return () => {
      u1()
      u3()
      u4()
    }
  }, [])

  const lista = useMemo(() => {
    const agora = Date.now()
    return cartoes
      .filter((c) => statusEfetivo(c) !== 'inativo')
      .map((c) => ({ c, vencido: statusEfetivo(c) === 'inadimplente', vencendo: statusEfetivo(c) === 'pago' && c.vencimento != null && c.vencimento - agora <= 7 * DIA_MS }))
      .filter((x) => x.vencido || x.vencendo)
      .filter((x) => filtro === 'todos' || (filtro === 'vencidos' ? x.vencido : x.vencendo))
      .sort((a, b) => (a.c.vencimento ?? 0) - (b.c.vencimento ?? 0))
  }, [cartoes, filtro])

  async function marcarCobrado(uid: string) {
    if (!staff) return
    await setDoc(doc(db, 'cobrancas', uid), {
      ultimaEm: serverTimestamp(),
      porUid: staff.uid,
      porNome: staff.nomeCompleto,
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold text-ink">Cobranças</h1>
      <p className="mb-5 text-sm text-mute">
        Associados com a mensalidade vencida ou que vence em até 7 dias. O botão abre o WhatsApp com a mensagem pronta.
      </p>

      <div className="mb-4 flex gap-2">
        {(['todos', 'vencidos', 'vencendo'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={filtro === f ? 'btn-primary' : 'btn-ghost'}
          >
            {f === 'todos' ? 'Todos' : f === 'vencidos' ? 'Vencidos' : 'Vencendo'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {lista.length === 0 && <p className="text-sm text-mute/70">Ninguém para cobrar nesse filtro.</p>}
        {lista.map(({ c }) => {
          const efetivo = statusEfetivo(c)
          const celular = contatos[c.uid]?.celular
          const link = celular ? linkWhatsapp(celular, mensagem(c, cfg?.valor ?? null)) : null
          const cobr = cobradas[c.uid]
          const cobrEm = cobr ? paraMillis(cobr.ultimaEm) : null
          return (
            <div key={c.uid} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{c.nomeCompleto}</p>
                <p className="text-xs text-mute">
                  <span className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[efetivo]}`}>
                    {STATUS_LABELS[efetivo]}
                  </span>
                  {c.vencimento ? `${efetivo === 'pago' ? 'vence' : 'venceu'} em ${formatarData(c.vencimento)}` : 'nunca pagou'}
                </p>
                {cobrEm && (
                  <p className="mt-1 text-[11px] text-mute/80">
                    Última cobrança: {formatarData(cobrEm)} por {cobr.porNome}
                  </p>
                )}
              </div>
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => marcarCobrado(c.uid)}
                  className="btn-primary whitespace-nowrap"
                >
                  Cobrar no WhatsApp
                </a>
              ) : (
                <span className="text-xs text-warn">sem celular cadastrado</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
