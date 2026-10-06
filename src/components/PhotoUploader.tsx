import { useRef, useState } from 'react'
import { CropFoto } from './CropFoto'

interface PhotoUploaderProps {
  currentUrl: string | null
  onChange: (dataUrl: string) => Promise<void>
}

export function PhotoUploader({ currentUrl, onChange }: PhotoUploaderProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salva, setSalva] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function limparInput() {
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem.')
      limparInput()
      return
    }
    setErro(null)
    setSalva(false)
    setArquivo(file)
  }

  function cancelar() {
    setArquivo(null)
    limparInput()
  }

  async function confirmar(dataUrl: string) {
    setArquivo(null)
    limparInput()
    setEnviando(true)
    try {
      await onChange(dataUrl)
      setSalva(true)
    } catch (err) {
      setErro((err as Error).message || 'Não foi possível salvar a foto. Tente novamente.')
    } finally {
      setEnviando(false)
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
      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={enviando}
          className="w-full max-w-full text-sm text-mute file:mr-3 file:rounded-sm file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hi"
        />
        {enviando && <p className="mt-1 text-xs text-mute">Salvando...</p>}
        {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
        {salva && <p className="mt-1 text-xs text-ok">Foto salva.</p>}
        <p className="mt-1 text-xs text-mute/70">
          Escolha a foto e enquadre só o rosto. O app reduz sozinho.
        </p>
      </div>

      {arquivo && <CropFoto file={arquivo} onCancel={cancelar} onConfirm={confirmar} />}
    </div>
  )
}
