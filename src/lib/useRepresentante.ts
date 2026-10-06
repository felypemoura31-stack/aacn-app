import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'

/** true se o usuário é representante de pelo menos um time (mostra a aba de solicitações). */
export function useEhRepresentante(uid: string | undefined) {
  const [ehRep, setEhRep] = useState(false)

  useEffect(() => {
    if (!uid) return setEhRep(false)
    const q = query(collection(db, 'teams'), where('representanteUid', '==', uid))
    return onSnapshot(q, (snap) => setEhRep(!snap.empty))
  }, [uid])

  return ehRep
}
