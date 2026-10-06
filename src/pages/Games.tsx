import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { cancelarMinhaInscricao, formatarCreditos, inscreverNoJogo, reais } from '../lib/credits'
import { useWallet } from '../lib/useWallet'
import { ExtratoCreditos } from '../components/ExtratoCreditos'
import type { Game, Participation } from '../types'

function quando(g: Game) {
  const d = new Date(g.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  return g.horario ? `${d} às ${g.horario}` : d
}

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
  const porJogo = new Map(minhas.map((p) => [p.gameId, p]))
  const abertos = games.filter((g) => g.status === 'aberto' || porJogo.has(g.id))

  async function agir(g: Game, acao: () => Promise<unknown>) {
    setErro(null)
    setBusyId(g.id)
    try {
      await acao()
    } catch {
      setErro('Não foi possível concluir. As vagas podem ter acabado nesse instante; tente de novo (se lotou, você entra na lista de espera).')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold text-ink">Jogos</h1>
      <p className="mb-2 text-sm text-mute">
        Seu saldo: <b className="text-gold">{formatarCreditos(saldo)} créditos</b>
      </p>
      <p className="mb-6 text-xs text-mute/80">
        A inscrição é grátis. O pagamento é feito no dia do jogo: a organização lê o QR da sua carteirinha, marca sua
        presença e debita os créditos. Leve a carteirinha no celular ou impressa.
      </p>

      {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}

      <div className="mb-8 space-y-3">
        {abertos.length === 0 && <p className="text-sm text-mute/70">Nenhum jogo com inscrições abertas.</p>}
        {abertos.map((g) => {
          const p = porJogo.get(g.id)
          const faltam = g.custoCreditos - saldo
          const inscritos = g.inscritos ?? 0
          const lotado = g.vagas != null && inscritos >= g.vagas
          return (
            <div key={g.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{g.nome}</p>
                  <p className="text-xs text-mute">
                    {quando(g)} · {reais(g.valor)} ou {formatarCreditos(g.custoCreditos)} créditos
                  </p>
                  {(g.local || g.localLink) && (
                    <p className="mt-1 text-xs text-mute">
                      {g.local}
                      {g.localLink && (
                        <>
                          {g.local ? ' · ' : ''}
                          <a href={g.localLink} target="_blank" rel="noopener noreferrer" className="text-accent-hi underline">
                            Ver no mapa
                          </a>
                        </>
                      )}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gold">
                    {g.vagas != null ? `${Math.min(inscritos, g.vagas)}/${g.vagas} vagas preenchidas` : `${inscritos} inscritos (sem limite de vagas)`}
                    {(g.espera ?? 0) > 0 && ` · ${g.espera} na lista de espera`}
                  </p>
                  {g.descricao && <p className="mt-2 whitespace-pre-line text-sm text-mute">{g.descricao}</p>}
                </div>

                <div className="text-right">
                  {p?.status === 'removida' && <span className="text-xs text-mute">Inscrição cancelada. Fale com a diretoria.</span>}

                  {p?.status === 'presente' && (
                    <span className="rounded-full border border-ok/40 bg-ok/15 px-3 py-1 text-xs font-semibold text-ok">Presença confirmada</span>
                  )}

                  {p?.status === 'espera' && (
                    <>
                      <span className="rounded-full border border-warn/40 bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">Na lista de espera</span>
                      <p className="mt-1 text-[11px] text-mute">A diretoria chama você se abrir uma vaga.</p>
                      <button disabled={busyId === g.id} onClick={() => agir(g, () => cancelarMinhaInscricao(p))} className="mt-1 text-[11px] text-danger hover:underline">
                        Sair da lista de espera
                      </button>
                    </>
                  )}

                  {p?.status === 'ativa' && (
                    <>
                      <span className="rounded-full border border-accent-hi/40 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-hi">Inscrito</span>
                      <p className="mt-1 max-w-[16rem] text-[11px] text-mute">
                        {faltam > 0
                          ? `Seu saldo não cobre o jogo (faltam ${formatarCreditos(faltam)}). Pague ${reais(g.valor)} no local.`
                          : `${formatarCreditos(g.custoCreditos)} créditos serão debitados no dia.`}
                      </p>
                      <button disabled={busyId === g.id} onClick={() => agir(g, () => cancelarMinhaInscricao(p))} className="mt-1 text-[11px] text-danger hover:underline">
                        Cancelar inscrição
                      </button>
                    </>
                  )}

                  {!p && (
                    <button disabled={busyId === g.id} onClick={() => agir(g, () => inscreverNoJogo(player, g))} className="btn-primary">
                      {lotado ? 'Entrar na lista de espera' : 'Inscrever-se'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">Minhas inscrições</h2>
      <div className="space-y-2">
        {minhas.length === 0 && <p className="text-sm text-mute/70">Você ainda não se inscreveu em nenhum jogo.</p>}
        {minhas.map((p) => (
          <div key={p.id} className="flex justify-between rounded-sm border border-line bg-surface2 px-4 py-2 text-sm text-mute">
            <span>{p.gameNome}</span>
            <span>
              {p.status === 'removida'
                ? 'cancelada'
                : p.status === 'espera'
                  ? 'na lista de espera'
                  : p.status === 'ativa'
                    ? 'aguardando check-in'
                    : p.pagoCom === 'creditos'
                      ? `presente · −${formatarCreditos(p.creditosDebitados)} créditos`
                      : 'presente · pago em dinheiro'}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-ink">Extrato de créditos</h2>
      <ExtratoCreditos uid={player.uid} />
    </div>
  )
}
