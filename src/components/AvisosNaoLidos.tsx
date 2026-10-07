import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAvisos } from '../contexts/AvisosContext'
import { formatarData, paraMillis } from '../lib/status'

/**
 * Avisos da diretoria que o jogador ainda não leu: aparecem logo abaixo do menu, acima de qualquer tela,
 * até ele tocar em "Lido". Os já lidos ficam no mural da carteirinha ("Avisos anteriores").
 */
export function AvisosNaoLidos() {
  const { currentUser, cadastroExcluido } = useAuth()
  const { naoLidos, marcarLido, marcarTodosLidos } = useAvisos()
  const [ocupado, setOcupado] = useState<string | null>(null)

  if (!currentUser || cadastroExcluido || naoLidos.length === 0) return null

  const mostrar = naoLidos.slice(0, 3)

  async function ler(id: string) {
    setOcupado(id)
    try {
      await marcarLido(id)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="no-print border-b border-gold/40 bg-gold/10">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-3">
        {mostrar.map((a) => (
          <article key={a.id} className="rounded-sm border border-gold/40 bg-surface px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">
                  <span aria-hidden="true">📢 </span>
                  {a.fixado && <span className="mr-2 rounded-sm bg-gold/20 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-gold">Fixado</span>}
                  {a.titulo}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-mute">{a.texto}</p>
                <p className="mt-1 text-[11px] text-mute/70">
                  {a.autorNome} · {formatarData(paraMillis(a.criadoEm))}
                </p>
              </div>
              <button
                onClick={() => ler(a.id)}
                disabled={ocupado === a.id}
                className="shrink-0 rounded-sm bg-gold px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-bg hover:opacity-90 disabled:opacity-60"
              >
                Lido
              </button>
            </div>
          </article>
        ))}
        {naoLidos.length > mostrar.length && (
          <p className="text-xs text-gold">
            + {naoLidos.length - mostrar.length} aviso(s) não lido(s).{' '}
            <button onClick={() => marcarTodosLidos()} className="underline hover:text-ink">
              Marcar todos como lidos
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
