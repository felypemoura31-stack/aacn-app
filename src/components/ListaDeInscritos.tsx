import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { carregarTimes } from '../lib/listaInscritos'
import type { Game, Participation } from '../types'

/**
 * "Ver lista de inscritos" de um jogo: quem já está inscrito (e quem já fez check-in), em ordem alfabética, com o time.
 * A lista só é lida quando a pessoa abre. A lista de espera não aparece.
 */
export function ListaDeInscritos({ jogo, meuUid }: { jogo: Game; meuUid: string }) {
  const [aberto, setAberto] = useState(false)
  const [lista, setLista] = useState<Participation[] | null>(null)
  const [times, setTimes] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!aberto) return
    // o filtro de status precisa estar na consulta: é ele que as regras do banco conferem
    const q = query(collection(db, 'participations'), where('gameId', '==', jogo.id), where('status', 'in', ['ativa', 'presente']))
    return onSnapshot(q, (snap) =>
      setLista(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Participation)
          .sort((a, b) => a.jogadorNome.localeCompare(b.jogadorNome, 'pt-BR')),
      ),
    )
  }, [aberto, jogo.id])

  useEffect(() => {
    if (aberto) void carregarTimes().then(setTimes)
  }, [aberto])

  const total = jogo.inscritos ?? 0
  const presentes = (lista ?? []).filter((p) => p.status === 'presente').length

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="text-xs font-semibold text-accent-hi underline">
        {aberto ? 'Esconder a lista de inscritos' : `Ver lista de inscritos (${total})`}
      </button>

      {aberto && (
        <div className="mt-2 rounded-sm border border-line bg-surface2 p-3">
          {lista === null && <p className="text-xs text-mute">Carregando...</p>}
          {lista && lista.length === 0 && <p className="text-xs text-mute/70">Ninguém inscrito ainda.</p>}
          {lista && lista.length > 0 && (
            <>
              <p className="mb-2 text-[11px] text-mute">
                {lista.length} {lista.length === 1 ? 'inscrito' : 'inscritos'}
                {presentes > 0 ? ` · ${presentes} com presença confirmada` : ''}
                {(jogo.espera ?? 0) > 0 ? ` · ${jogo.espera} na lista de espera` : ''}
              </p>
              <ol className="space-y-1">
                {lista.map((p, i) => (
                  <li key={p.id} className="flex items-baseline gap-2 text-sm">
                    <span className="w-5 shrink-0 text-right text-[11px] text-mute/70">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className={p.uid === meuUid ? 'font-semibold text-gold' : 'text-ink'}>{p.jogadorNome}</span>
                      {p.uid === meuUid && <span className="ml-1 text-[11px] text-gold">(você)</span>}
                      {p.convidado ? <span className="ml-1 text-[11px] text-mute">· convidado</span> : times[p.uid] && <span className="ml-1 text-[11px] text-mute">· {times[p.uid]}</span>}
                    </span>
                    {p.status === 'presente' && <span className="shrink-0 rounded-full border border-ok/40 bg-ok/15 px-1.5 py-0.5 text-[10px] font-semibold text-ok">presente</span>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  )
}
