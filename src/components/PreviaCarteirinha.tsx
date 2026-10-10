import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { CarteirinhaFrente } from './CarteirinhaImpressao'

/**
 * A frente da carteirinha no tamanho real (85,6 x 54 mm) reduzida para caber na largura que a grade der:
 * é a mesma frente da impressão, só que menor. Acompanha o redimensionamento da janela.
 */
export function PreviaCarteirinha(props: ComponentProps<typeof CarteirinhaFrente>) {
  const caixa = useRef<HTMLDivElement>(null)
  const interno = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.5)

  useEffect(() => {
    const c = caixa.current
    const i = interno.current
    if (!c || !i) return
    const medir = () => {
      if (i.offsetWidth > 0 && c.clientWidth > 0) setEscala(c.clientWidth / i.offsetWidth)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={caixa} className="relative w-full overflow-hidden" style={{ aspectRatio: '85.6 / 54', borderRadius: '3.2%' }}>
      <div ref={interno} className="pointer-events-none" style={{ width: '85.6mm', height: '54mm', transform: `scale(${escala})`, transformOrigin: 'top left' }}>
        <CarteirinhaFrente {...props} />
      </div>
    </div>
  )
}
