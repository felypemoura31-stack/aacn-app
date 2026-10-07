import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'
import { CONQUISTAS, contextoDoJogador, reivindicarConquista, type ContextoConquistas, type DefConquista } from '../lib/conquistas'
import { formatarCreditos } from '../lib/credits'
import { paraMillis } from '../lib/status'
import type { ConquistaResgatada, Estatisticas, Game, Participation } from '../types'

export interface ConquistaDoJogador extends DefConquista {
  /** Atingiu a meta (mesmo que o bônus ainda esteja sendo creditado). */
  atingida: boolean
  /** Conquista do jogador (selo visível). */
  resgatada: boolean
  /** Revogada pela diretoria: não aparece como conquista e não é resgatada de novo sozinha. */
  revogada: boolean
  /** Créditos que esta conquista pagou (0 se a diretoria concedeu sem bônus). */
  pago: number
}

interface ConquistasValue {
  carregando: boolean
  contexto: ContextoConquistas
  conquistas: ConquistaDoJogador[]
  bonusRecebido: number
}

const Ctx = createContext<ConquistasValue | undefined>(undefined)

/**
 * Acompanha as conquistas do jogador logado e, quando uma é atingida, resgata o bônus de
 * créditos sozinha (o banco confere a meta). Fica no topo do app para o bônus cair mesmo
 * que o jogador não abra a tela de histórico.
 */
export function ConquistasProvider({ children }: { children: ReactNode }) {
  const { player } = useAuth()
  const uid = player?.uid
  const [stats, setStats] = useState<Estatisticas | null | undefined>(undefined)
  const [resgatadas, setResgatadas] = useState<Record<string, ConquistaResgatada> | null>(null)
  const [parts, setParts] = useState<Participation[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [avisos, setAvisos] = useState<{ id: string; texto: string }[]>([])
  const ocupado = useRef(false)
  const falhou = useRef(new Set<string>())
  const tentativas = useRef(new Map<string, number>())
  const [rodada, setRodada] = useState(0)

  useEffect(() => {
    setStats(undefined)
    setResgatadas(null)
    setParts([])
    setAvisos([])
    falhou.current.clear()
    tentativas.current.clear()
    if (!uid) return
    const unsubs = [
      onSnapshot(doc(db, 'stats', uid), (s) => setStats(s.exists() ? (s.data() as Estatisticas) : null), () => setStats(null)),
      onSnapshot(query(collection(db, 'conquistas'), where('uid', '==', uid)), (s) => {
        const m: Record<string, ConquistaResgatada> = {}
        s.docs.forEach((d) => (m[(d.data() as ConquistaResgatada).conquista] = d.data() as ConquistaResgatada))
        setResgatadas(m)
      }),
      onSnapshot(query(collection(db, 'participations'), where('uid', '==', uid)), (s) =>
        setParts(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation)),
      ),
      onSnapshot(collection(db, 'games'), (s) => setGames(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Game))),
    ]
    return () => unsubs.forEach((u) => u())
  }, [uid])

  // faltas: inscrito, o jogo já passou e nunca fez check-in
  const faltas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const dataPorJogo = new Map(games.map((g) => [g.id, g.data]))
    return parts.filter((p) => p.status === 'ativa' && (dataPorJogo.get(p.gameId) ?? '9999') < hoje).length
  }, [parts, games])

  const contexto = useMemo(
    () => contextoDoJogador({ timeAprovado: !!player?.timeAprovado }, stats ?? null, faltas, paraMillis(player?.criadoEm)),
    [player?.timeAprovado, player?.criadoEm, stats, faltas],
  )

  const conquistas = useMemo<ConquistaDoJogador[]>(
    () =>
      CONQUISTAS.map((c) => {
        const d = resgatadas?.[c.id]
        return { ...c, atingida: c.ok(contexto), resgatada: !!d && !d.revogada, revogada: !!d?.revogada, pago: d && !d.revogada ? Number(d.creditos ?? 0) : 0 }
      }),
    [contexto, resgatadas],
  )

  // resgate automático, uma conquista por vez (cada uma soma na carteira)
  useEffect(() => {
    if (!player || stats === undefined || resgatadas === null || ocupado.current) return
    const pendentes = conquistas.filter((c) => c.atingida && !c.resgatada && !c.revogada && !falhou.current.has(c.id))
    if (pendentes.length === 0) return
    ocupado.current = true
    ;(async () => {
      for (const c of pendentes) {
        try {
          await reivindicarConquista(player, c)
          setAvisos((a) => [...a, { id: c.id, texto: `${c.titulo}: +${formatarCreditos(c.bonus)} créditos` }])
        } catch (e) {
          // tenta de novo em alguns segundos (conexão ruim, saldo desatualizado); depois de 3 falhas desiste até reabrir o app
          const n = (tentativas.current.get(c.id) ?? 0) + 1
          tentativas.current.set(c.id, n)
          falhou.current.add(c.id)
          console.warn('Não foi possível resgatar a conquista', c.id, e)
          if (n < 3) {
            setTimeout(() => {
              falhou.current.delete(c.id)
              setRodada((r) => r + 1)
            }, 8000 * n)
          }
        }
      }
    })().finally(() => {
      ocupado.current = false
      setRodada((r) => r + 1)
    })
  }, [player, stats, resgatadas, conquistas, rodada])

  const bonusRecebido = conquistas.reduce((s, c) => s + c.pago, 0)

  return (
    <Ctx.Provider value={{ carregando: stats === undefined || resgatadas === null, contexto, conquistas, bonusRecebido }}>
      {children}
      {avisos.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="chamfer panel w-full max-w-sm border-gold/50 p-4 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-gold">Conquista desbloqueada</p>
            {avisos.map((a) => (
              <p key={a.id} className="mt-1 text-sm text-ink">
                ★ {a.texto}
              </p>
            ))}
            <button onClick={() => setAvisos([])} className="btn-ghost mt-3 w-full">
              Ok
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useConquistas() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useConquistas precisa do ConquistasProvider')
  return v
}
