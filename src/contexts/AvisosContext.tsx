import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'
import { paraMillis } from '../lib/status'
import type { Aviso } from '../types'

interface AvisosValue {
  /** Avisos que o jogador ainda não marcou como lidos (fixados primeiro, depois os mais novos). */
  naoLidos: Aviso[]
  /** Avisos já lidos, do mais novo para o mais antigo. */
  lidos: Aviso[]
  marcarLido: (id: string) => Promise<void>
  marcarTodosLidos: () => Promise<void>
}

const Ctx = createContext<AvisosValue>({ naoLidos: [], lidos: [], marcarLido: async () => {}, marcarTodosLidos: async () => {} })

const LIMITE_LEITURAS = 300

/**
 * Mural de avisos com "lido": cada jogador guarda, em leituras/{uid}, quais avisos já leu (vale em todos os
 * aparelhos). Um aviso que existia antes de a conta ser criada conta como lido, exceto os fixados.
 */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const { currentUser, player } = useAuth()
  const uid = currentUser?.uid
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  const [lidosIds, setLidosIds] = useState<string[] | null>(null)

  useEffect(() => {
    setAvisos(null)
    setLidosIds(null)
    if (!uid) return
    const u1 = onSnapshot(query(collection(db, 'avisos'), orderBy('criadoEm', 'desc')), (snap) =>
      setAvisos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso)),
    )
    const u2 = onSnapshot(
      doc(db, 'leituras', uid),
      (snap) => setLidosIds(snap.exists() ? (((snap.data() as { avisos?: string[] }).avisos ?? []) as string[]) : []),
      () => setLidosIds([]),
    )
    return () => {
      u1()
      u2()
    }
  }, [uid])

  const criadaEm = paraMillis(player?.criadoEm) ?? 0

  const { naoLidos, lidos } = useMemo(() => {
    if (!avisos || !lidosIds) return { naoLidos: [], lidos: [] }
    const sets = new Set(lidosIds)
    const jaLido = (a: Aviso) => sets.has(a.id) || (!a.fixado && (paraMillis(a.criadoEm) ?? 0) < criadaEm)
    const nao = avisos.filter((a) => !jaLido(a)).sort((a, b) => Number(!!b.fixado) - Number(!!a.fixado))
    return { naoLidos: nao, lidos: avisos.filter(jaLido) }
  }, [avisos, lidosIds, criadaEm])

  async function gravar(ids: string[]) {
    if (!uid || !avisos) return
    // só guarda ids de avisos que ainda existem (a lista não cresce para sempre)
    const existentes = new Set(avisos.map((a) => a.id))
    const lista = [...new Set(ids)].filter((id) => existentes.has(id)).slice(-LIMITE_LEITURAS)
    await setDoc(doc(db, 'leituras', uid), { avisos: lista, atualizadoEm: serverTimestamp() })
  }

  const value: AvisosValue = {
    naoLidos,
    lidos,
    marcarLido: (id) => gravar([...(lidosIds ?? []), id]),
    marcarTodosLidos: () => gravar([...(lidosIds ?? []), ...naoLidos.map((a) => a.id)]),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAvisos() {
  return useContext(Ctx)
}
