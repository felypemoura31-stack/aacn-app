import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'
import type { Team, TeamJoinRequest } from '../types'

interface PedidosValue {
  /** Pedidos de entrada aguardando o representante (vazio para quem não representa time). */
  pendentes: TeamJoinRequest[]
}

const Ctx = createContext<PedidosValue>({ pendentes: [] })

/** Avisa o aparelho (se a pessoa permitiu) quando chega um pedido novo, com o app aberto ou em segundo plano. */
async function avisarNoAparelho(r: TeamJoinRequest) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const titulo = `Novo pedido para entrar no ${r.timeNome}`
    const opcoes: NotificationOptions = {
      body: `${r.jogadorNome} quer entrar no seu time. Abra "Solicitações do time" para aprovar ou recusar.`,
      icon: '/logo.png',
      tag: `pedido-${r.id}`,
    }
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(titulo, opcoes)
    else new Notification(titulo, opcoes)
  } catch {
    // sem permissão ou sem suporte: o aviso dentro do app continua valendo
  }
}

/**
 * Acompanha, em tempo real, os pedidos de entrada nos times que o usuário representa. Alimenta o aviso
 * dentro do app (faixa e marcador no menu) e, se permitido, a notificação do aparelho.
 */
export function PedidosProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth()
  const uid = currentUser?.uid
  const [times, setTimes] = useState<Team[]>([])
  const [pendentes, setPendentes] = useState<TeamJoinRequest[]>([])
  const anteriores = useRef<Set<string> | null>(null)

  useEffect(() => {
    setTimes([])
    setPendentes([])
    anteriores.current = null
    if (!uid) return
    return onSnapshot(query(collection(db, 'teams'), where('representanteUid', '==', uid)), (snap) =>
      setTimes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team)),
    )
  }, [uid])

  useEffect(() => {
    anteriores.current = null // a primeira leitura só mostra o que já estava lá, sem notificar
    if (times.length === 0) {
      setPendentes([])
      return
    }
    const q = query(
      collection(db, 'teamJoinRequests'),
      where('timeId', 'in', times.map((t) => t.id).slice(0, 10)),
      where('status', '==', 'pendente'),
    )
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TeamJoinRequest)
      // pedido que chegou depois de o app já estar acompanhando
      if (anteriores.current) for (const p of lista) if (!anteriores.current.has(p.id)) avisarNoAparelho(p)
      anteriores.current = new Set(lista.map((p) => p.id))
      setPendentes(lista)
    })
  }, [times])

  return <Ctx.Provider value={{ pendentes }}>{children}</Ctx.Provider>
}

export function usePedidos() {
  return useContext(Ctx)
}
