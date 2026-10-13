import { baixarIcs, linkGoogleAgenda } from '../lib/calendario'
import type { Game } from '../types'

/** Dois botões pequenos: Google Agenda (abre o evento já preenchido) e arquivo .ics (iPhone, Outlook e outros). */
export function AdicionarAoCalendario({ jogo }: { jogo: Game }) {
  const origem = window.location.origin
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mute">
      <span>Lembrete no calendário:</span>
      <a href={linkGoogleAgenda(jogo, origem)} target="_blank" rel="noopener noreferrer" className="text-accent-hi underline">
        Google Agenda
      </a>
      <button type="button" onClick={() => baixarIcs(jogo, origem)} className="text-accent-hi underline">
        iPhone / Outlook (.ics)
      </button>
    </p>
  )
}
