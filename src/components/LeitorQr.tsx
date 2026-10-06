import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

interface LeitorQrProps {
  onLeitura: (texto: string) => void
  pausado: boolean
}

/** Liga a câmera traseira e lê QR codes continuamente. Monte só quando quiser usar a câmera. */
export function LeitorQr({ onLeitura, pausado }: LeitorQrProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const onLeituraRef = useRef(onLeitura)
  const pausadoRef = useRef(pausado)
  onLeituraRef.current = onLeitura
  pausadoRef.current = pausado

  useEffect(() => {
    let parar = false
    let stream: MediaStream | undefined
    let raf = 0
    let ultimoQuadro = 0
    let ultimoTexto = ''
    let ultimoTextoEm = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('Este navegador não permite usar a câmera aqui. Use o campo de código abaixo.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        setErro('Não consegui acessar a câmera. Permita o acesso no navegador ou use o campo de código abaixo.')
        return
      }
      if (parar) return stream.getTracks().forEach((t) => t.stop())
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setPronto(true)

      const loop = (t: number) => {
        if (parar) return
        raf = requestAnimationFrame(loop)
        if (t - ultimoQuadro < 120 || video.readyState < 2 || !video.videoWidth) return
        ultimoQuadro = t
        const w = Math.min(640, video.videoWidth)
        const h = Math.round((video.videoHeight * w) / video.videoWidth)
        canvas.width = w
        canvas.height = h
        ctx.drawImage(video, 0, 0, w, h)
        const img = ctx.getImageData(0, 0, w, h)
        const r = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
        if (!r?.data || pausadoRef.current) return
        // evita processar o mesmo QR várias vezes seguidas
        if (r.data === ultimoTexto && t - ultimoTextoEm < 3000) return
        ultimoTexto = r.data
        ultimoTextoEm = t
        onLeituraRef.current(r.data)
      }
      raf = requestAnimationFrame(loop)
    }

    iniciar()
    return () => {
      parar = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div>
      {erro && <p className="rounded-sm border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">{erro}</p>}
      {!erro && (
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-sm border border-line bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {!pronto && <p className="absolute inset-0 flex items-center justify-center text-sm text-mute">Abrindo câmera...</p>}
          <div className="pointer-events-none absolute inset-6 rounded-sm border-2 border-dashed border-white/60" />
        </div>
      )}
    </div>
  )
}
