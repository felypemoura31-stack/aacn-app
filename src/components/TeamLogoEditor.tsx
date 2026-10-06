import { useRef, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { reduzirLogo } from '../lib/foto'
import type { Team } from '../types'

/** Mostra e troca a logo de um time. Usado pelo admin e pelo representante do time. */
export function TeamLogoEditor({ team }: { team: Team }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function salvar(logoUrl: string | null) {
    await updateDoc(doc(db, 'teams', team.id), { logoUrl })
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro(null)
    if (!file.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setEnviando(true)
    try {
      await salvar(await reduzirLogo(file))
    } catch (err) {
      setErro((err as Error).message || 'Não foi possível salvar a logo. Tente novamente.')
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remover() {
    setErro(null)
    setEnviando(true)
    try {
      await salvar(null)
    } catch {
      setErro('Não foi possível remover a logo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-white">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt={`Logo ${team.nome}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="px-1 text-center text-[10px] text-slate-400">Sem logo</span>
        )}
      </div>
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={enviando}
          className="max-w-full text-sm text-mute file:mr-3 file:rounded-sm file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hi"
        />
        {team.logoUrl && !enviando && (
          <button type="button" onClick={remover} className="mt-1 block text-xs text-danger hover:underline">
            Remover logo
          </button>
        )}
        {enviando && <p className="mt-1 text-xs text-mute">Salvando...</p>}
        {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
        <p className="mt-1 text-xs text-mute/70">Aparece na carteirinha dos jogadores do time. PNG com fundo transparente fica melhor.</p>
      </div>
    </div>
  )
}
