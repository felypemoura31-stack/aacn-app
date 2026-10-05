import { useRef, useState } from 'react'
import { reduzirFoto } from '../lib/foto'

interface PhotoUploaderProps {
  currentUrl: string | null
  onChange: (dataUrl: string) => Promise<void>
}

export function PhotoUploader({ currentUrl, onChange }: PhotoUploaderProps) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem.')
      return
    }
    setErro(null)
    setEnviando(true)
    try {
      await onChange(await reduzirFoto(file))
    } catch (err) {
      setErro((err as Error).message || 'Falha ao processar a foto. Tente outra imagem.')
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface2">
        {currentUrl ? (
          <img src={currentUrl} alt="Foto 3x4" className="h-full w-full object-cover" />
        ) : (
          <span className="px-1 text-center text-xs text-mute/70">Sem foto</span>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={enviando}
          className="text-sm text-mute file:mr-3 file:rounded-sm file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hi"
        />
        {enviando && <p className="mt-1 text-xs text-mute">Processando...</p>}
        {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
        <p className="mt-1 text-xs text-mute/70">
          Foto de rosto, de frente. O app recorta no formato 3x4 e reduz sozinho.
        </p>
      </div>
    </div>
  )
}
