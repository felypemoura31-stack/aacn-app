import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { Wallet } from '../types'

export function useWallet(uid: string | undefined) {
  const [wallet, setWallet] = useState<Wallet | null>(null)

  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, 'wallets', uid), (snap) => {
      setWallet(snap.exists() ? (snap.data() as Wallet) : null)
    })
  }, [uid])

  return wallet
}
