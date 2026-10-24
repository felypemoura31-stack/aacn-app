import { PESO_MAX, PESO_MIN, rotuloDoPeso } from '../lib/sorteio'

/** Escolha do peso (0 = Highlander, 1 = novato ... 5 = veterano ... 9). Só o admin vê como seletor; os demais veem o valor. */
export function SeletorPeso({ valor, aoMudar, desabilitado = false }: { valor: number; aoMudar: (peso: number) => void; desabilitado?: boolean }) {
  const opcoes = Array.from({ length: PESO_MAX - PESO_MIN + 1 }, (_, i) => PESO_MIN + i)
  return (
    <select
      value={valor}
      disabled={desabilitado}
      onChange={(e) => aoMudar(Number(e.target.value))}
      className="rounded-sm border border-line bg-surface2 px-2 py-1 text-xs text-ink disabled:opacity-60"
      aria-label="Peso no sorteio"
    >
      {opcoes.map((p) => (
        <option key={p} value={p}>
          {p} · {rotuloDoPeso(p)}
        </option>
      ))}
    </select>
  )
}

/** Etiqueta do peso para quem só lê. */
export function EtiquetaPeso({ peso }: { peso: number }) {
  const cor = peso >= 5 ? 'border-gold/40 bg-gold/15 text-gold' : peso >= 2 ? 'border-accent-hi/40 bg-accent/15 text-accent-hi' : 'border-line text-mute'
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cor}`}>{peso === 0 ? 'Highlander' : `peso ${peso}`}</span>
}
