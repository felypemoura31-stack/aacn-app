import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { formatarCreditos, participarComCreditos, reais } from '../lib/credits'
import { useWallet } from '../lib/useWallet'
import { ExtratoCreditos } from '../components/ExtratoCreditos'
import type { Game, Participation } from '../types'

export function Games() {
  const { player } = useAuth()
  const wallet = useWallet(player?.uid)
  const [games, setGames] = useState<Game[]>([])
  const [minhas, setMinhas] = useState<Participation[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('data'))
    return onSnapshot(q, (snap) => {
      setGames(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Game))
    })
  }, [])

  useEffect(() => {
    if (!player) return
    const q = query(collection(db, 'participations'), where('uid', '==', player.uid))
    return onSnapshot(q, (snap) => {
      setMinhas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation))
    })
  }, [player])

  if (!player) return null

  const saldo = wallet?.creditos ?? 0
  const inscritoEm = new Set(minhas.filter((p) => p.status !== 'removida').map((p) => p.gameId))
  const canceladoEm = new Set(minhas.filter((p) => p.status === 'removida').map((p) => p.gameId))
  const abertos = games.filter((g) => g.status === 'aberto')

  async function participar(g: Game) {
    setErro(null)
    setBusyId(g.id)
    try {
      await participarComCreditos(player!, g)
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível se inscrever. Tente novamente.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold text-ink">Jogos</h1>
      <p className="mb-6 text-sm text-mute">
        Seu saldo: <b className="text-gold">{formatarCreditos(saldo)} créditos</b>
      </p>

      {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}

      <div className="mb-8 space-y-3">
        {abertos.length === 0 && (
          <p className="text-sm text-mute/70">Nenhum jogo com inscrições abertas.</p>
        )}
        {abertos.map((g) => {
          const jaInscrito = inscritoEm.has(g.id)
          const faltam = g.custoCreditos - saldo
          return (
            <div key={g.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-ink">{g.nome}</p>
                <p className="text-xs text-mute">
                  {new Date(g.data + 'T12:00').toLocaleDateString('pt-BR')} · {reais(g.valor)} ou{' '}
                  {formatarCreditos(g.custoCreditos)} créditos
                </p>
              </div>
              {canceladoEm.has(g.id) ? (
                <span className="text-xs text-mute">Inscrição cancelada. Fale com a diretoria.</span>
              ) : jaInscrito ? (
                <span className="rounded-full border border-ok/40 bg-ok/15 px-3 py-1 text-xs font-semibold text-ok">
                  Inscrito
                </span>
              ) : (
                <div className="text-right">
                  <button
                    disabled={busyId === g.id || faltam > 0}
                    onClick={() => participar(g)}
                    className="btn-primary"
                  >
                    Participar ({formatarCreditos(g.custoCreditos)} créditos)
                  </button>
                  {faltam > 0 && (
                    <p className="mt-1 text-[11px] text-mute">
                      Faltam {formatarCreditos(faltam)} créditos. Pague {reais(g.valor)} no local.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">Minhas inscrições</h2>
      <div className="space-y-2">
        {minhas.length === 0 && <p className="text-sm text-mute/70">Você ainda não se inscreveu em nenhum jogo.</p>}
        {minhas.map((p) => (
          <div
            key={p.id}
            className="flex justify-between rounded-sm border border-line bg-surface2 px-4 py-2 text-sm text-mute"
          >
            <span>{p.gameNome}</span>
            <span>
              {p.status === 'removida'
                ? 'cancelada'
                : p.pagoCom === 'creditos'
                ? `−${formatarCreditos(p.creditosDebitados)} créditos`
                : 'pago em dinheiro'}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-ink">Extrato de créditos</h2>
      <ExtratoCreditos uid={player.uid} />
    </div>
  )
}
