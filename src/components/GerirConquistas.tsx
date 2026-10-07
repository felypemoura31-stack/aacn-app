import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { CONQUISTAS, concederConquista, removerConquista, type DefConquista } from '../lib/conquistas'
import { formatarCreditos } from '../lib/credits'
import { formatarData, paraMillis } from '../lib/status'
import type { ConquistaResgatada } from '../types'

/**
 * Admin: o que o jogador já conquistou e o que ainda pode conquistar, em duas linhas de etiquetas.
 * Clicar numa etiqueta abre a ação (conceder ou remover) logo abaixo.
 */
export function GerirConquistas({ uid, nome }: { uid: string; nome: string }) {
  const { player: admin } = useAuth()
  const [docs, setDocs] = useState<Record<string, ConquistaResgatada> | null>(null)
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [mexerNosCreditos, setMexerNosCreditos] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'conquistas'), where('uid', '==', uid))
    return onSnapshot(q, (s) => {
      const m: Record<string, ConquistaResgatada> = {}
      s.docs.forEach((d) => (m[(d.data() as ConquistaResgatada).conquista] = d.data() as ConquistaResgatada))
      setDocs(m)
    })
  }, [uid])

  if (!admin) return null

  const conquistadas = docs ? CONQUISTAS.filter((c) => docs[c.id]) : []
  const faltam = docs ? CONQUISTAS.filter((c) => !docs[c.id]) : []
  const sel = escolhida ? CONQUISTAS.find((c) => c.id === escolhida) ?? null : null
  const selDoc = sel && docs ? docs[sel.id] : undefined

  function escolher(c: DefConquista) {
    setErro(null)
    setMexerNosCreditos(true)
    setEscolhida((atual) => (atual === c.id ? null : c.id))
  }

  async function executar() {
    if (!sel || !admin) return
    setErro(null)
    setOcupado(true)
    const autor = { uid: admin.uid, nome: admin.nomeCompleto }
    try {
      if (selDoc) await removerConquista({ uid, nome }, sel, mexerNosCreditos, autor)
      else await concederConquista({ uid, nome }, sel, mexerNosCreditos, autor)
      setEscolhida(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui concluir.')
    } finally {
      setOcupado(false)
    }
  }

  const etiqueta = (c: DefConquista, conquistada: boolean) => (
    <button
      key={c.id}
      type="button"
      onClick={() => escolher(c)}
      title={c.desc}
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
        conquistada
          ? c.grupo === 'noturnas'
            ? 'border-accent-hi/50 bg-accent/15 text-ink'
            : 'border-gold/50 bg-gold/10 text-gold'
          : 'border-line text-mute hover:border-mute hover:text-ink'
      } ${escolhida === c.id ? 'ring-2 ring-accent-hi' : ''}`}
    >
      {conquistada ? `${c.icone} ${c.titulo}` : `${c.titulo} · +${formatarCreditos(c.bonus)}`}
    </button>
  )

  return (
    <details className="panel">
      <summary className="cursor-pointer select-none px-5 py-3 text-sm font-bold text-ink">
        Conquistas {docs && <span className="font-normal text-mute">({conquistadas.length}/{CONQUISTAS.length})</span>}
      </summary>
      <div className="space-y-4 px-5 pb-5">
        {docs === null && <p className="text-xs text-mute">Carregando...</p>}
        {docs && (
          <>
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-widest text-mute/80">Conquistadas ({conquistadas.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {conquistadas.length === 0 && <span className="text-xs text-mute/70">Nenhuma ainda.</span>}
                {conquistadas.map((c) => etiqueta(c, true))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-widest text-mute/80">Ainda pode conquistar ({faltam.length}) · bônus em créditos</p>
              <div className="flex flex-wrap gap-1.5">
                {faltam.length === 0 && <span className="text-xs text-mute/70">Já conquistou todas.</span>}
                {faltam.map((c) => etiqueta(c, false))}
              </div>
            </div>
            <p className="text-[11px] text-mute/70">Clique numa etiqueta para conceder ou remover.</p>
          </>
        )}

        {sel && docs && (
          <div className="rounded-sm border border-line bg-surface2 p-3 text-sm">
            <p className="font-semibold text-ink">
              {sel.icone} {sel.titulo} <span className="font-normal text-mute">· {sel.desc}</span>
            </p>
            {selDoc ? (
              <>
                <p className="mt-1 text-[11px] text-mute">
                  Concedida em {formatarData(paraMillis(selDoc.criadoEm))}
                  {selDoc.concedidaPorNome ? ` por ${selDoc.concedidaPorNome}` : ' (automática)'}
                  {selDoc.creditos > 0 ? ` · pagou +${formatarCreditos(selDoc.creditos)} créditos` : ' · sem bônus'}.
                </p>
                {selDoc.creditos > 0 && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-mute">
                    <input type="checkbox" checked={mexerNosCreditos} onChange={(e) => setMexerNosCreditos(e.target.checked)} />
                    Retirar também os {formatarCreditos(selDoc.creditos)} créditos do saldo
                  </label>
                )}
                <p className="mt-1 text-[11px] text-mute/80">A conquista volta a ficar “a conquistar”. Se ele ainda cumpre a meta, recebe de novo ao abrir o app.</p>
              </>
            ) : (
              <label className="mt-2 flex items-center gap-2 text-xs text-mute">
                <input type="checkbox" checked={mexerNosCreditos} onChange={(e) => setMexerNosCreditos(e.target.checked)} />
                Pagar o bônus de +{formatarCreditos(sel.bonus)} créditos
              </label>
            )}
            {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={executar} disabled={ocupado} className={selDoc ? 'btn-ghost text-danger' : 'btn-primary'}>
                {ocupado ? 'Aguarde...' : selDoc ? 'Remover conquista' : 'Conceder conquista'}
              </button>
              <button onClick={() => setEscolhida(null)} className="btn-ghost">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}
