/**
 * Insígnias das conquistas, desenhadas como patentes: nas séries (jogos jogados e jogos noturnos) a
 * insígnia evolui a cada passo, com mais divisas e, no último nível, uma barra e uma estrela.
 * São SVG próprios (cores chapadas, sem imagem externa), então ficam nítidas em qualquer tamanho e na impressão.
 */

const PLACA = 'M8 11 L32 3 L56 11 L56 50 Q56 62 32 70 Q8 62 8 50 Z'

/** Série de cada conquista e o nível (1 = primeiro passo). As que não são de série usam um desenho próprio. */
const SERIES: Record<string, { serie: 'jogos' | 'noturnas'; nivel: 1 | 2 | 3 | 4 }> = {
  primeiro: { serie: 'jogos', nivel: 1 },
  campo: { serie: 'jogos', nivel: 2 },
  veterano: { serie: 'jogos', nivel: 3 },
  lenda: { serie: 'jogos', nivel: 4 },
  noturno1: { serie: 'noturnas', nivel: 1 },
  penumbra: { serie: 'noturnas', nivel: 2 },
  escuridao: { serie: 'noturnas', nivel: 3 },
  sombras: { serie: 'noturnas', nivel: 4 },
}

const CORES = {
  jogos: { placa: '#7a2323', borda: '#3a1010', divisa: '#f2c230', sombra: '#9a7400' },
  noturnas: { placa: '#10244f', borda: '#08122b', divisa: '#d3deef', sombra: '#6c7c99' },
  especial: { placa: '#1c3f78', borda: '#0b1f44', divisa: '#f2c230', sombra: '#9a7400' },
}

/** Divisa em V (como numa patente): uma por nível, de cima para baixo. */
function Divisa({ y, cor, sombra, espessura = 6 }: { y: number; cor: string; sombra: string; espessura?: number }) {
  const pontos = `14,${y + 13} 32,${y} 50,${y + 13}`
  return (
    <>
      <polyline points={pontos} fill="none" stroke={sombra} strokeWidth={espessura + 3} strokeLinejoin="miter" />
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth={espessura} strokeLinejoin="miter" />
    </>
  )
}

function Estrela({ cx, cy, r, cor, sombra }: { cx: number; cy: number; r: number; cor: string; sombra: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const raio = i % 2 === 0 ? r : r * 0.45
    const a = (Math.PI / 5) * i - Math.PI / 2
    return `${(cx + raio * Math.cos(a)).toFixed(1)},${(cy + raio * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  return <polygon points={pts} fill={cor} stroke={sombra} strokeWidth="1" strokeLinejoin="round" />
}

function Lua({ cx, cy, r, cor, fundo }: { cx: number; cy: number; r: number; cor: string; fundo: string }) {
  // quarto crescente: um círculo claro com outro, da cor da placa, deslocado por cima
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={cor} />
      <circle cx={cx + r * 0.55} cy={cy - r * 0.2} r={r * 0.85} fill={fundo} />
    </>
  )
}

function Serie({ serie, nivel }: { serie: 'jogos' | 'noturnas'; nivel: 1 | 2 | 3 | 4 }) {
  const c = CORES[serie]
  const ys = nivel === 1 ? [28] : nivel === 2 ? [22, 34] : nivel === 3 ? [16, 27, 38] : [9, 18, 27]
  return (
    <>
      {ys.map((y) => (
        <Divisa key={y} y={y} cor={c.divisa} sombra={c.sombra} espessura={nivel === 4 ? 4.5 : 6} />
      ))}
      {nivel === 4 && (
        <>
          <path d="M14 45 Q32 55 50 45" fill="none" stroke={c.sombra} strokeWidth="7.5" />
          <path d="M14 45 Q32 55 50 45" fill="none" stroke={c.divisa} strokeWidth="4.5" />
          <Estrela cx={32} cy={59} r={5.5} cor={c.divisa} sombra={c.sombra} />
        </>
      )}
      {serie === 'noturnas' && nivel < 4 && <Lua cx={32} cy={57} r={6} cor={c.divisa} fundo={c.placa} />}
    </>
  )
}

function Especial({ id }: { id: string }) {
  const c = CORES.especial
  switch (id) {
    case 'assiduo': // alvo: pontualidade e presença
      return (
        <>
          <circle cx="32" cy="38" r="15" fill="none" stroke={c.divisa} strokeWidth="4" />
          <circle cx="32" cy="38" r="8" fill="none" stroke={c.divisa} strokeWidth="4" />
          <circle cx="32" cy="38" r="2.6" fill={c.divisa} />
        </>
      )
    case 'emdia': // visto: mensalidades em dia
      return (
        <>
          <circle cx="32" cy="38" r="17" fill="none" stroke={c.divisa} strokeWidth="3.5" />
          <polyline points="22,39 29,46 43,29" fill="none" stroke={c.divisa} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'ano': // louros e estrela: um ano de AACN
      return (
        <>
          <path d="M17 28 Q13 48 27 59" fill="none" stroke={c.divisa} strokeWidth="4" strokeLinecap="round" />
          <path d="M47 28 Q51 48 37 59" fill="none" stroke={c.divisa} strokeWidth="4" strokeLinecap="round" />
          <Estrela cx={32} cy={36} r={11} cor={c.divisa} sombra={c.sombra} />
        </>
      )
    case 'time': // bandeira: faz parte de um time
      return (
        <>
          <line x1="24" y1="21" x2="24" y2="58" stroke={c.divisa} strokeWidth="4" strokeLinecap="round" />
          <polygon points="26,22 47,30 26,38" fill={c.divisa} stroke={c.sombra} strokeWidth="1.5" strokeLinejoin="round" />
        </>
      )
    default:
      return <Estrela cx={32} cy={38} r={14} cor={c.divisa} sombra={c.sombra} />
  }
}

/** Insígnia de uma conquista (pelo id). `tamanho` é a largura em pixels (a altura segue a proporção 64:72). */
export function IconeConquista({ id, tamanho = 32, apagado = false, className = '' }: { id: string; tamanho?: number; apagado?: boolean; className?: string }) {
  const s = SERIES[id]
  const c = s ? CORES[s.serie] : CORES.especial
  return (
    <svg
      viewBox="0 0 64 72"
      width={tamanho}
      height={(tamanho * 72) / 64}
      className={className}
      style={apagado ? { opacity: 0.35, filter: 'grayscale(1)' } : undefined}
      role="img"
      aria-hidden="true"
    >
      <path d={PLACA} fill={c.placa} stroke={c.borda} strokeWidth="3" strokeLinejoin="round" />
      {s ? <Serie serie={s.serie} nivel={s.nivel} /> : <Especial id={id} />}
    </svg>
  )
}
