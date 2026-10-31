import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { cancelarMinhaInscricao, formatarCreditos, inscreverNoJogo, reais } from '../lib/credits'
import { useWallet } from '../lib/useWallet'
import { ExtratoCreditos } from '../components/ExtratoCreditos'
import { AdicionarAoCalendario } from '../components/AdicionarAoCalendario'
import { BotaoListaWhatsapp } from '../components/BotaoListaWhatsapp'
import { ListaDeInscritos } from '../components/ListaDeInscritos'
import { TimesSorteadosDoJogo, type SorteioPublicado } from '../components/TimesSorteadosDoJogo'
import type { Game, Participation } from '../types'

function quando(g: Game) {
  const d = new Date(g.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  return g.horario ? `${d} às ${g.horario}` : d
}

export function Games() {
  const { player } = useAuth()
  const wallet = useWallet(player?.uid)
  const [params] = useSearchParams()
  const jogoDoLink = params.get('jogo') // link recebido pelo WhatsApp: leva direto a este jogo
  const [games, setGames] = useState<Game[]>([])
  const [minhas, setMinhas] = useState<Participation[]>([])
  const [sorteios, setSorteios] = useState<Record<string, SorteioPublicado>>({})
  const [recemInscrito, setRecemInscrito] = useState<string | null>(null) // jogo em que a pessoa acabou de se inscrever
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

  // times sorteados que a diretoria já publicou (a consulta precisa do filtro, senão as regras do banco recusam)
  useEffect(() => {
    const q = query(collection(db, 'sorteios'), where('publicado', '==', true))
    return onSnapshot(q, (snap) => {
      const m: Record<string, SorteioPublicado> = {}
      snap.docs.forEach((d) => (m[d.id] = d.data() as SorteioPublicado))
      setSorteios(m)
    })
  }, [])

  // abre o jogo do link: rola até ele depois que a lista carrega
  useEffect(() => {
    if (!jogoDoLink || !games.some((g) => g.id === jogoDoLink)) return
    document.getElementById(`jogo-${jogoDoLink}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [jogoDoLink, games])

  if (!player) return null

  const saldo = wallet?.creditos ?? 0
  const d0 = new Date()
  const hojeIso = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`
  const porJogo = new Map(minhas.map((p) => [p.gameId, p]))
  // jogo cancelado aparece para todos enquanto não passou (para ninguém ir ao campo à toa) e para quem estava inscrito
  const abertos = games.filter((g) => g.status === 'aberto' || porJogo.has(g.id) || (g.status === 'cancelado' && g.data >= hojeIso))

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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Jogos</h1>
          <p className="text-xs text-mute">Inscrição grátis. O pagamento é no dia: a organização lê o QR da sua carteirinha e debita os créditos.</p>
        </div>
        <p className="rounded-sm border border-line bg-surface px-3 py-1.5 text-sm text-mute">
          Saldo: <b className="text-gold">{formatarCreditos(saldo)} créditos</b>
        </p>
      </div>

      {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}

      {jogoDoLink && games.length > 0 && !abertos.some((g) => g.id === jogoDoLink) && (
        <p className="mb-4 rounded-sm border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          {games.some((g) => g.id === jogoDoLink)
            ? games.find((g) => g.id === jogoDoLink)?.status === 'cancelado'
              ? 'Este jogo foi cancelado.'
              : 'As inscrições deste jogo foram encerradas.'
            : 'Este jogo não existe mais.'}
        </p>
      )}

      <div className="mb-6 grid items-start gap-3 lg:grid-cols-2">
        {abertos.length === 0 && <p className="text-sm text-mute/70">Nenhum jogo com inscrições abertas.</p>}
        {abertos.map((g) => {
          const p = porJogo.get(g.id)
          const faltam = g.custoCreditos - saldo
          const inscritos = g.inscritos ?? 0
          const lotado = g.vagas != null && inscritos >= g.vagas
          const cancelado = g.status === 'cancelado'
          return (
            <div key={g.id} id={`jogo-${g.id}`} className={`panel p-4 ${cancelado ? 'border-danger/50' : ''} ${g.id === jogoDoLink ? 'ring-2 ring-accent-hi' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {g.nome}
                    {cancelado && <span className="ml-2 rounded-full border border-danger/50 bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">Cancelado</span>}
                  </p>
                  <p className={`text-xs text-mute ${cancelado ? 'line-through' : ''}`}>
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
                  {cancelado && (
                    <div className="mt-2 rounded-sm border border-danger/40 bg-danger/10 p-3">
                      <p className="text-sm font-semibold text-danger">Este jogo foi cancelado.</p>
                      {g.motivoCancelamento && <p className="mt-1 text-sm text-ink">Motivo: {g.motivoCancelamento}</p>}
                      <p className="mt-1 text-xs text-mute">
                        {p && p.status !== 'removida' ? 'Sua inscrição fica sem efeito e nada será cobrado.' : 'Nada será cobrado.'} Acompanhe os avisos para a próxima data.
                      </p>
                    </div>
                  )}
                  {!cancelado && (
                    <p className="mt-1 text-xs text-gold">
                      {g.vagas != null ? `${Math.min(inscritos, g.vagas)}/${g.vagas} vagas preenchidas` : `${inscritos} inscritos (sem limite de vagas)`}
                      {(g.espera ?? 0) > 0 && ` · ${g.espera} na lista de espera`}
                    </p>
                  )}
                  {g.descricao && !cancelado && <p className="mt-2 whitespace-pre-line text-sm text-mute">{g.descricao}</p>}
                  {recemInscrito === g.id && p?.status === 'ativa' && !cancelado && (
                    <div className="mt-3 rounded-sm border border-ok/40 bg-ok/10 p-3">
                      <p className="mb-2 text-sm font-semibold text-ok">Inscrição feita! Avise o pessoal no WhatsApp:</p>
                      <BotaoListaWhatsapp jogo={g} destaque />
                    </div>
                  )}
                  {g.data >= hojeIso && !cancelado && <AdicionarAoCalendario jogo={g} />}
                  {!cancelado && <ListaDeInscritos jogo={g} meuUid={player.uid} />}
                  {sorteios[g.id] && !cancelado && <TimesSorteadosDoJogo sorteio={sorteios[g.id]} meuUid={player.uid} />}
                </div>

                <div className="text-right">
                  {!cancelado && p?.status === 'removida' && <span className="text-xs text-mute">Inscrição cancelada. Fale com a diretoria.</span>}

                  {p?.status === 'presente' && (
                    <span className="rounded-full border border-ok/40 bg-ok/15 px-3 py-1 text-xs font-semibold text-ok">Presença confirmada</span>
                  )}

                  {!cancelado && p?.status === 'espera' && (
                    <>
                      <span className="rounded-full border border-warn/40 bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">Na lista de espera</span>
                      <p className="mt-1 text-[11px] text-mute">A diretoria chama você se abrir uma vaga.</p>
                      <button disabled={busyId === g.id} onClick={() => agir(g, () => cancelarMinhaInscricao(p))} className="mt-1 text-[11px] text-danger hover:underline">
                        Sair da lista de espera
                      </button>
                    </>
                  )}

                  {!cancelado && p?.status === 'ativa' && (
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
                      {recemInscrito !== g.id && (
                        <div>
                          <BotaoListaWhatsapp jogo={g} />
                        </div>
                      )}
                    </>
                  )}

                  {!cancelado && !p && (
                    <button
                      disabled={busyId === g.id}
                      onClick={() =>
                        agir(g, async () => {
                          const r = await inscreverNoJogo(player, g)
                          if (r === 'ativa') setRecemInscrito(g.id)
                        })
                      }
                      className="btn-primary"
                    >
                      {lotado ? 'Entrar na lista de espera' : 'Inscrever-se'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <details className="panel">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-ink">Extrato de créditos</summary>
        <div className="px-4 pb-4">
          <ExtratoCreditos uid={player.uid} />
        </div>
      </details>
    </div>
  )
}
