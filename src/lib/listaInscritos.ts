import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

/** Nome do time de cada jogador (do cartão público). Baixado uma vez por visita, só quando alguém precisa. */
let timesPorUid: Promise<Record<string, string | null>> | null = null

export function carregarTimes() {
  timesPorUid ??= getDocs(collection(db, 'publicCards'))
    .then((snap) => {
      const m: Record<string, string | null> = {}
      snap.docs.forEach((d) => (m[d.id] = (d.data() as { timeNome?: string | null }).timeNome ?? null))
      return m
    })
    .catch(() => {
      timesPorUid = null
      return {}
    })
  return timesPorUid
}
