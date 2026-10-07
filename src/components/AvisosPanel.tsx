import { useAvisos } from '../contexts/AvisosContext'
import { formatarData, paraMillis } from '../lib/status'

/** Avisos que o jogador já leu, recolhidos na tela da carteirinha. Os novos aparecem no topo do app, até virarem "lidos". */
export function AvisosPanel({ className = '' }: { className?: string }) {
  const { lidos } = useAvisos()
  if (lidos.length === 0) return null

  return (
    <details className={`no-print panel ${className}`}>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-ink">
        Avisos anteriores <span className="font-normal text-mute">({lidos.length})</span>
      </summary>
      <div className="divide-y divide-line border-t border-line">
        {lidos.slice(0, 10).map((a) => (
          <article key={a.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">{a.titulo}</h3>
              <span className="shrink-0 text-[11px] text-mute/80">{formatarData(paraMillis(a.criadoEm))}</span>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-mute">{a.texto}</p>
          </article>
        ))}
      </div>
    </details>
  )
}
