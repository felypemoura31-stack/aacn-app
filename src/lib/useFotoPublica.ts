import { useEffect, useState } from 'react'
import { lerFotoPublica } from './publicCard'

/** A foto 3x4 pública de um jogador: a do cartão antigo (`legado`), se ainda houver, ou a de publicFotos/{uid}. */
export function useFotoPublica(uid: string, legado?: string | null) {
  const [foto, setFoto] = useState<string | null>(null)
  useEffect(() => {
    if (legado) return
    let vivo = true
    lerFotoPublica(uid)
      .then((f) => vivo && setFoto(f))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [uid, legado])
  return legado ?? foto
}
