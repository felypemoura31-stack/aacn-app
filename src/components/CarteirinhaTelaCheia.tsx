import { useEffect, useState, type ComponentProps } from 'react'
import { CarteirinhaFrente } from './CarteirinhaImpressao'

/** 85,6 x 54 mm em pixels do navegador (96 por polegada). */
const LARGURA_PX = (85.6 * 96) / 25.4
const ALTURA_PX = (54 * 96) / 25.4

/**
 * A frente da carteirinha ocupando a tela toda, sempre deitada: se o celular está em pé, o conteúdo é girado 90°
 * (basta virar o aparelho para ler). Fundo branco para o leitor de QR code. O botão Fechar fica no canto da tela,
 * fora da parte girada.
 */
export function CarteirinhaTelaCheia({ aoFechar, ...props }: ComponentProps<typeof CarteirinhaFrente> & { aoFechar: () => void }) {
  const [tela, setTela] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const medir = () => setTela({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', medir)
    window.addEventListener('orientationchange', medir)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    // trava a rolagem da página por baixo (corpo e raiz)
    const rolagemCorpo = document.body.style.overflow
    const rolagemRaiz = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('orientationchange', medir)
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = rolagemCorpo
      document.documentElement.style.overflow = rolagemRaiz
    }
  }, [aoFechar])

  const emPe = tela.h > tela.w
  // o "palco" é a tela vista de lado: largura = lado maior, altura = lado menor
  const palcoL = emPe ? tela.h : tela.w
  const palcoA = emPe ? tela.w : tela.h
  // sobra uma faixa para o aviso do brilho, nas duas bordas (o cartão fica centralizado)
  const escala = Math.min(palcoL / LARGURA_PX, (palcoA - 36) / ALTURA_PX) * 0.97

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-white" role="dialog" aria-modal="true" aria-label="Carteirinha em tela cheia">
      <div
        className="flex items-center justify-center"
        style={
          emPe
            ? { position: 'absolute', left: tela.w, top: 0, width: palcoL, height: palcoA, transformOrigin: '0 0', transform: 'rotate(90deg)' }
            : { position: 'absolute', inset: 0 }
        }
      >
        <div className="pointer-events-none" style={{ width: LARGURA_PX, height: ALTURA_PX, flex: 'none', transform: `scale(${escala})` }}>
          <CarteirinhaFrente {...props} />
        </div>
      </div>

      <button
        type="button"
        onClick={aoFechar}
        className="fixed right-3 top-3 z-10 rounded-full border border-slate-300 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow"
      >
        ✕ Fechar
      </button>
      <p className="pointer-events-none fixed bottom-2 left-3 right-3 text-center text-[11px] text-slate-400">
        Aumente o brilho do celular para o leitor ler o QR code melhor.
      </p>
    </div>
  )
}
