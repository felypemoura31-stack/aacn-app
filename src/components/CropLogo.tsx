import { useEffect, useRef, useState } from 'react'
import {
  ZOOM_MAX,
  abrirImagem,
  desenharRecorteQuadrado,
  exportarLogo,
  limitarCentroQuadrado,
  pixelsPorToqueQuadrado,
  type Centro,
  type ImagemCarregada,
} from '../lib/foto'

interface CropLogoProps {
  file: File
  titulo?: string
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}

const LADO_TELA = 260

/**
 * Recorte quadrado para logos de time e de lojas parceiras. Com o zoom no mínimo aparece a imagem inteira (as sobras
 * ficam transparentes); aumentando o zoom e arrastando, recorta só a parte que interessa. Mantém a transparência do PNG.
 */
export function CropLogo({ file, titulo = 'Enquadre a imagem', onCancel, onConfirm }: CropLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const arrasto = useRef<{ x: number; y: number } | null>(null)
  const [img, setImg] = useState<ImagemCarregada | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [centro, setCentro] = useState<Centro>({ x: 0, y: 0 })

  useEffect(() => {
    let ativo = true
    let aberta: ImagemCarregada | null = null
    abrirImagem(file)
      .then((i) => {
        if (!ativo) return i.fechar()
        aberta = i
        setImg(i)
        setCentro({ x: i.largura / 2, y: i.altura / 2 })
      })
      .catch((e: Error) => ativo && setErro(e.message))
    return () => {
      ativo = false
      aberta?.fechar()
    }
  }, [file])

  useEffect(() => {
    if (img && canvasRef.current) desenharRecorteQuadrado(canvasRef.current, img, centro, zoom, '#e2e8f0')
  }, [img, centro, zoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(1, z * (1 - e.deltaY * 0.002))))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [img])

  function mudarZoom(novo: number) {
    setZoom(novo)
    if (img) setCentro((c) => limitarCentroQuadrado(img, c, novo))
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    arrasto.current = { x: e.clientX, y: e.clientY }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!arrasto.current || !img) return
    const passo = pixelsPorToqueQuadrado(img, zoom, LADO_TELA)
    const dx = (e.clientX - arrasto.current.x) * passo
    const dy = (e.clientY - arrasto.current.y) * passo
    arrasto.current = { x: e.clientX, y: e.clientY }
    setCentro((c) => limitarCentroQuadrado(img, { x: c.x - dx, y: c.y - dy }, zoom))
  }

  function confirmar() {
    if (!img) return
    try {
      onConfirm(exportarLogo(img, centro, zoom))
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 p-4">
      <div className="panel w-full max-w-sm p-5">
        <h2 className="mb-1 text-sm font-bold text-ink">{titulo}</h2>
        <p className="mb-3 text-xs text-mute">Arraste a imagem e use o zoom para escolher o que fica. O quadrado inteiro é o recorte; com o zoom no mínimo, a imagem aparece inteira.</p>

        {erro && <p className="mb-3 text-sm text-danger">{erro}</p>}
        {!img && !erro && <p className="py-16 text-center text-sm text-mute">Carregando imagem...</p>}

        {img && (
          <>
            <div className="mx-auto touch-none select-none" style={{ width: LADO_TELA, height: LADO_TELA }}>
              <canvas
                ref={canvasRef}
                width={LADO_TELA * 2}
                height={LADO_TELA * 2}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => (arrasto.current = null)}
                onPointerCancel={() => (arrasto.current = null)}
                className="h-full w-full cursor-grab touch-none rounded-sm border border-line active:cursor-grabbing"
              />
            </div>

            <label className="mt-4 block text-xs text-mute">
              Zoom
              <input
                type="range"
                min={1}
                max={ZOOM_MAX}
                step={0.01}
                value={zoom}
                onChange={(e) => mudarZoom(Number(e.target.value))}
                className="mt-1 w-full accent-[var(--color-accent-hi)]"
              />
            </label>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={!img} className="btn-primary">
            Usar esta imagem
          </button>
        </div>
      </div>
    </div>
  )
}
