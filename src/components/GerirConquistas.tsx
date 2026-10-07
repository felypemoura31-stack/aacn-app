import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { CONQUISTAS, GRUPOS, concederConquista, revogarConquista, type DefConquista } from '../lib/conquistas'
import { formatarCreditos } from '../lib/credits'
import { formatarData, paraMillis } from '../lib/status'
import type { ConquistaResgatada } from '../types'

/** Admin: vê as conquistas de um jogador e concede ou revoga uma a uma. */
export function GerirConquistas({ uid, nome }: { uid: string; nome: string }) {
  const { player: admin } = useAuth()
  const [docs, setDocs] = useState<Record<string, ConquistaResgatada> | null>(null)
  const [creditar, setCreditar] = useState<Record<string, boolean>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
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
  const autor = { uid: admin.uid, nome: admin.nomeCompleto }
  const alvo = { uid, nome }

  async function agir(c: DefConquista, acao: () => Promise<unknown>) {
    setErro(null)
    setOcupado(c.id)
    try {
      await acao()
      // a caixa volta ao padrão (revogar e conceder usam a mesma caixa, com sentidos diferentes)
      setCreditar((m) => {
        const n = { ...m }
        delete n[c.id]
        return n
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui concluir.')
    } finally {
      setOcupado(null)
    }
  }

  const ativas = CONQUISTAS.filter((c) => docs?.[c.id] && !docs[c.id].revogada).length

  return (
    <div className="panel mb-6 p-5">
      <h2 className="text-sm font-bold text-ink">
        Conquistas {docs && <span className="font-normal text-mute">({ativas}/{CONQUISTAS.length})</span>}
      </h2>
      <p className="mt-1 text-xs text-mute">
        Conceda uma conquista que o jogador merece e não recebeu, ou revogue uma indevida. Revogada, ela não é resgatada
        de novo sozinha. O bônus em créditos é opcional e vai para o extrato.
      </p>
      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
      {docs === null && <p className="mt-2 text-xs text-mute">Carregando...</p>}

      {docs &&
        GRUPOS.map((g) => (
          <div key={g.id} className="mt-4">
            <h3 className="mb-1 text-[11px] uppercase tracking-widest text-mute/80">{g.titulo}</h3>
            <div className="space-y-1">
              {CONQUISTAS.filter((c) => c.grupo === g.id).map((c) => {
                const d = docs[c.id]
                const ativa = !!d && !d.revogada
                const revogada = !!d?.revogada
                const marcar = creditar[c.id] ?? !d // novo: marcado; já existente: desmarcado
                return (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line bg-surface2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {c.icone} {c.titulo}
                      </p>
                      <p className="text-[11px] text-mute">
                        {ativa
                          ? `Concedida em ${formatarData(paraMillis(d.criadoEm))}${d.concedidaPorNome ? ` por ${d.concedidaPorNome}` : ' (automática)'}${d.creditos > 0 ? ` · +${formatarCreditos(d.creditos)} créditos` : ' · sem bônus'}`
                          : revogada
                            ? 'Revogada pela diretoria'
                            : `Não concedida · bônus de ${formatarCreditos(c.bonus)} créditos`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[11px] text-mute">
                        <input
                          type="checkbox"
                          checked={marcar}
                          onChange={(e) => setCreditar((m) => ({ ...m, [c.id]: e.target.checked }))}
                        />
                        {ativa ? 'retirar créditos' : `+${formatarCreditos(c.bonus)} créditos`}
                      </label>
                      {ativa ? (
                        <button
                          disabled={ocupado === c.id}
                          onClick={() => agir(c, () => revogarConquista(alvo, c, creditar[c.id] ?? false, autor))}
                          className="btn-ghost text-danger"
                        >
                          Revogar
                        </button>
                      ) : (
                        <button
                          disabled={ocupado === c.id}
                          onClick={() => agir(c, () => concederConquista(alvo, c, marcar, autor))}
                          className="btn-primary"
                        >
                          {revogada ? 'Devolver' : 'Conceder'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}
