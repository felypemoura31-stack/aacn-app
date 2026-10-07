import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { CONQUISTAS } from '../lib/conquistas'
import { IconeConquista } from './IconeConquista'
import type { ConquistaResgatada } from '../types'

export const MAX_DESTAQUES = 3

/**
 * As conquistas já ganhas por um jogador, como insígnias. Com `onAlternar`, o jogador toca nas insígnias para
 * escolher (até 3) as que aparecem na carteirinha dele; a ordem da escolha é a ordem na carteirinha.
 */
export function SelosConquistas({
  uid,
  titulo = 'Conquistas',
  className = 'mx-auto mt-6 w-full max-w-sm',
  escolhidas,
  onAlternar,
}: {
  uid: string
  titulo?: string
  className?: string
  escolhidas?: string[]
  onAlternar?: (id: string) => Promise<void> | void
}) {
  const [ids, setIds] = useState<Set<string> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'conquistas'), where('uid', '==', uid))
    return onSnapshot(
      q,
      (s) => setIds(new Set(s.docs.map((d) => (d.data() as ConquistaResgatada).conquista))),
      () => setIds(new Set()),
    )
  }, [uid])

  const ganhas = CONQUISTAS.filter((c) => ids?.has(c.id))
  const editavel = !!onAlternar
  const lista = escolhidas ?? []

  async function alternar(id: string) {
    setErro(null)
    if (!lista.includes(id) && lista.length >= MAX_DESTAQUES) {
      setErro(`A carteirinha tem espaço para ${MAX_DESTAQUES}. Toque numa escolhida para trocar.`)
      return
    }
    try {
      await onAlternar?.(id)
    } catch {
      setErro('Não consegui salvar agora. Tente de novo.')
    }
  }

  return (
    <div className={`no-print panel p-5 ${className}`}>
      <h2 className="text-sm font-bold text-ink">
        {titulo} {ids && <span className="font-normal text-mute">({ganhas.length}/{CONQUISTAS.length})</span>}
      </h2>
      {editavel && ganhas.length > 0 && (
        <p className="mt-1 text-[11px] text-mute">
          Toque para escolher até {MAX_DESTAQUES} que aparecem na sua carteirinha ({lista.length}/{MAX_DESTAQUES}).
        </p>
      )}
      {ids === null && <p className="mt-2 text-xs text-mute">Carregando...</p>}
      {ids && ganhas.length === 0 && <p className="mt-2 text-xs text-mute/70">Nenhuma conquista ainda. Elas aparecem aqui quando forem desbloqueadas.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {ganhas.map((c) => {
          const ordem = lista.indexOf(c.id)
          const marcada = ordem >= 0
          const miolo = (
            <>
              <span className="relative">
                <IconeConquista id={c.id} tamanho={34} />
                {marcada && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-hi text-[10px] font-bold text-white">
                    {ordem + 1}
                  </span>
                )}
              </span>
              <span className="mt-1 block w-[4.6rem] truncate text-center text-[10px] font-semibold leading-tight text-ink">{c.titulo}</span>
            </>
          )
          const base = 'flex flex-col items-center rounded-sm border px-1.5 py-2'
          return editavel ? (
            <button
              key={c.id}
              type="button"
              onClick={() => alternar(c.id)}
              title={marcada ? `${c.desc} (na carteirinha, toque para tirar)` : `${c.desc} (toque para pôr na carteirinha)`}
              className={`${base} transition-colors ${marcada ? 'border-accent-hi bg-accent/15' : 'border-line hover:border-mute'}`}
            >
              {miolo}
            </button>
          ) : (
            <span key={c.id} title={c.desc} className={`${base} border-line`}>
              {miolo}
            </span>
          )
        })}
      </div>
      {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
    </div>
  )
}
