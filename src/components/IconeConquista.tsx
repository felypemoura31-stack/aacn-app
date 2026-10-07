import primeiro from '../assets/conquistas/primeiro.svg'
import campo from '../assets/conquistas/campo.svg'
import veterano from '../assets/conquistas/veterano.svg'
import lenda from '../assets/conquistas/lenda.svg'
import assiduo from '../assets/conquistas/assiduo.svg'
import noturno1 from '../assets/conquistas/noturno1.svg'
import penumbra from '../assets/conquistas/penumbra.svg'
import escuridao from '../assets/conquistas/escuridao.svg'
import sombras from '../assets/conquistas/sombras.svg'
import emdia from '../assets/conquistas/emdia.svg'
import ano from '../assets/conquistas/ano.svg'
import time from '../assets/conquistas/time.svg'

/**
 * Ícones táticos das conquistas (arquivos SVG em src/assets/conquistas). Nas séries de jogos jogados e de
 * jogos noturnos o desenho evolui a cada passo. Cada SVG é carregado como imagem, então os identificadores
 * internos de um não se misturam com os de outro na mesma tela.
 */
const ICONES: Record<string, string> = {
  primeiro,
  campo,
  veterano,
  lenda,
  assiduo,
  noturno1,
  penumbra,
  escuridao,
  sombras,
  emdia,
  ano,
  time,
}

/** Ícone de uma conquista (pelo id). `tamanho` é o lado em pixels; sem `tamanho`, o tamanho vem do CSS. */
export function IconeConquista({ id, tamanho, apagado = false, className = '' }: { id: string; tamanho?: number; apagado?: boolean; className?: string }) {
  const src = ICONES[id]
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={tamanho}
      height={tamanho}
      className={className}
      style={apagado ? { opacity: 0.35, filter: 'grayscale(1)' } : undefined}
    />
  )
}
