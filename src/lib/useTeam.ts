import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { Team } from '../types'

export function useTeam(timeId: string | null | undefined) {
  const [team, setTeam] = useState<Team | null>(null)

  useEffect(() => {
    if (!timeId) return setTeam(null)
    return onSnapshot(doc(db, 'teams', timeId), (snap) => {
      setTeam(snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null)
    })
  }, [timeId])

  return team
}
