export interface SorteioPublicado {
  gameId: string
  times: { nome: string; jogadores: { uid: string; nome: string }[] }[]
}

/** Os times sorteados de um jogo, como os jogadores veem (só nomes; os pesos são da diretoria). */
export function TimesSorteadosDoJogo({ sorteio, meuUid }: { sorteio: SorteioPublicado; meuUid: string }) {
  const meu = sorteio.times.find((t) => t.jogadores.some((j) => j.uid === meuUid))
  return (
    <div className="mt-3 rounded-sm border border-gold/40 bg-gold/5 p-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gold">Times sorteados</p>
      {meu && (
        <p className="mt-1 text-sm text-ink">
          Você está no time <b className="text-gold">{meu.nome}</b>.
        </p>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {sorteio.times.map((t) => (
          <div key={t.nome} className={`rounded-sm border px-2 py-1.5 ${t === meu ? 'border-gold/60 bg-gold/10' : 'border-line bg-surface2'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-ink">
              {t.nome} <span className="font-normal text-mute">({t.jogadores.length})</span>
            </p>
            <p className="mt-0.5 text-xs text-mute">{t.jogadores.map((j) => j.nome).join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
