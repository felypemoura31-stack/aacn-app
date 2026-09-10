import { useRef, useState } from 'react'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase'

interface PhotoUploaderProps {
  uid: string
  currentUrl: string | null
  onUploaded: (url: string) => void
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024

export function PhotoUploader({ uid, currentUrl, onUploaded }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('A imagem deve ter no máximo 5MB.')
      return
    }

    setError(null)
    setUploading(true)
    try {
      const storageRef = ref(storage, `fotos-3x4/${uid}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      onUploaded(url)
    } catch {
      setError('Falha ao enviar a foto. Tente novamente.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-20 items-center justify-center overflow-hidden rounded border border-slate-300 bg-slate-100">
        {currentUrl ? (
          <img src={currentUrl} alt="Foto 3x4" className="h-full w-full object-cover" />
        ) : (
          <span className="px-1 text-center text-xs text-slate-400">Sem foto</span>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
        {uploading && <p className="mt-1 text-xs text-slate-500">Enviando...</p>}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <p className="mt-1 text-xs text-slate-400">Foto formato 3x4, máx. 5MB.</p>
      </div>
    </div>
  )
}
