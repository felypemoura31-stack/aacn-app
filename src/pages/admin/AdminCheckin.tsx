import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { LeitorQr } from '../../components/LeitorQr'
import {
  fazerCheckIn,
  formatarCreditos,
  lerCarteira,
  participationId,
  reais,
} from '../../lib/credits'
import { STATUS_COLORS, STATUS_LABELS, formatarData, statusEfetivo } from '../../lib/status'
import type { Game, Participation, PlayerStatus } from '../../types'

interface Cartao {
  nomeCompleto: string
  fotoUrl: string | null
  timeNome: string | null
  status: PlayerStatus
  vencimento: number | null
}

interface Alvo {
  uid: string
  cartao: Cartao
  part: Participation | null
  saldo: number
}

/** Aceita o link do QR da carteirinha (.../verificar/<uid>) ou o código puro. */
function extrairUid(texto: string) {
  const t = texto.trim()
  const m = t.match(/\/verificar\/([A-Za-z0-9_-]{6,64})\/?(?:[?#].*)?$/)
  const uid = m ? m[1] : /^[A-Za-z0-9_-]{6,64}$/.test(t) ? t : null
  return uid
}

export function AdminCheckin() {
  const { player: staff } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [gameId, setGameId] = useState('')
  const [parts, setParts] = useState<Participation[]>([])
  const [camera, setCamera] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [alvo, setAlvo] = useState<Alvo | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('data', 'desc'))
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Game)
      setGames(lista)
      setGameId((atual) => {
        if (atual && lista.some((g) => g.id === atual)) return atual
        // por padrão, o jogo mais próximo de hoje
        const hoje = Date.now()
        const prox = [...lista].sort(
          (a, b) =>
            Math.abs(new Date(a.data + 'T12:00').getTime() - hoje) -
            Math.abs(new Date(b.data + 'T12:00').getTime() - hoje),
        )[0]
        return prox?.id ?? ''
      })
    })
  }, [])

  useEffect(() => {
    if (!gameId) return setParts([])
    const q = query(collection(db, 'participations'), where('gameId', '==', gameId))
    return onSnapshot(q, (snap) =>
      setParts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation)),
    )
  }, [gameId])

  const game = games.find((g) => g.id === gameId)
  const lista = useMemo(
    () =>
      parts
        .filter((p) => p.status === 'ativa' || p.status === 'presente')
        .sort((a, b) => a.jogadorNome.localeCompare(b.jogadorNome)),
    [parts],
  )
  const presentes = lista.filter((p) => p.status === 'presente').length

  async function processar(texto: string) {
    if (!game) return setAviso({ tipo: 'erro', texto: 'Escolha o jogo primeiro.' })
    const uid = extrairUid(texto)
    if (!uid) return setAviso({ tipo: 'erro', texto: 'Esse código não é de uma carteirinha da AACN.' })

    setCarregando(true)
    setAviso(null)
    setAlvo(null)
    try {
      const cartaoSnap = await getDoc(doc(db, 'publicCards', uid))
      if (!cartaoSnap.exists()) {
        setAviso({ tipo: 'erro', texto: 'Carteirinha não encontrada.' })
        return
      }
      const [partSnap, carteira] = await Promise.all([
        getDoc(doc(db, 'participations', participationId(game.id, uid))),
        lerCarteira(uid),
      ])
      setAlvo({
        uid,
        cartao: cartaoSnap.data() as Cartao,
        part: partSnap.exists() ? ({ id: partSnap.id, ...partSnap.data() } as Participation) : null,
        saldo: carteira.saldo,
      })
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não foi possível consultar essa carteirinha. Tente de novo.' })
    } finally {
      setCarregando(false)
    }
  }

  function aoDigitar(e: FormEvent) {
    e.preventDefault()
    if (codigo.trim()) processar(codigo)
    setCodigo('')
  }

  async function confirmar(modo: 'creditos' | 'dinheiro') {
    if (!alvo?.part || !game || !staff) return
    setEnviando(true)
    try {
      await fazerCheckIn(game, alvo.part, modo, { uid: staff.uid, nome: staff.nomeCompleto })
      const saldoNovo = modo === 'creditos' ? alvo.saldo - game.custoCreditos : alvo.saldo
      setAviso({
        tipo: 'ok',
        texto:
          modo === 'creditos'
            ? `Presença de ${alvo.cartao.nomeCompleto} confirmada. Debitados ${formatarCreditos(game.custoCreditos)} créditos (saldo: ${formatarCreditos(saldoNovo)}).`
            : `Presença de ${alvo.cartao.nomeCompleto} confirmada (pagou ${reais(game.valor)} em dinheiro).`,
      })
      setAlvo(null)
    } catch (e) {
      setAviso({ tipo: 'erro', texto: (e as Error).message || 'Não foi possível confirmar. Tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  const status = alvo ? statusEfetivo(alvo.cartao) : null
  const jaPresente = alvo?.part?.status === 'presente'
  const cancelada = alvo?.part?.status === 'removida'
  const podeDebitar = !!alvo && !!game && alvo.saldo >= game.custoCreditos

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold text-ink">Check-in por QR</h1>
      <p className="mb-6 text-sm text-mute">
        Leia o QR da carteirinha do jogador para marcar a presença e fazer a cobrança do jogo.
      </p>

      <label className="mb-4 block text-sm text-mute">
        Jogo
        <select value={gameId} onChange={(e) => { setGameId(e.target.value); setAlvo(null); setAviso(null) }} className="input mt-1">
          {games.length === 0 && <option value="">Nenhum jogo cadastrado</option>}
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {new Date(g.data + 'T12:00').toLocaleDateString('pt-BR')} · {g.nome}
              {g.status === 'encerrado' ? ' (inscrições encerradas)' : ''}
            </option>
          ))}
        </select>
      </label>

      {game && (
        <p className="mb-4 text-xs text-mute">
          Custo: <b className="text-ink">{formatarCreditos(game.custoCreditos)} créditos</b> ou{' '}
          <b className="text-ink">{reais(game.valor)}</b> em dinheiro · {presentes} presentes de {lista.length} inscritos
        </p>
      )}

      <div className="panel mb-6 space-y-4 p-4">
        {camera ? (
          <>
            <LeitorQr onLeitura={processar} pausado={carregando || !!alvo} />
            <button onClick={() => setCamera(false)} className="btn-ghost w-full">
              Desligar câmera
            </button>
          </>
        ) : (
          <button onClick={() => setCamera(true)} disabled={!game} className="btn-primary w-full">
            Ligar câmera e ler QR
          </button>
        )}

        <form onSubmit={aoDigitar} className="flex gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ou cole o link/código do QR"
            className="input"
          />
          <button type="submit" disabled={!game} className="btn-ghost whitespace-nowrap">
            Buscar
          </button>
        </form>
      </div>

      {carregando && <p className="mb-4 text-sm text-mute">Consultando carteirinha...</p>}

      {aviso && (
        <p
          className={`mb-4 rounded-sm border px-4 py-3 text-sm ${
            aviso.tipo === 'ok' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-danger/40 bg-danger/10 text-danger'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {alvo && game && (
        <div className="panel chamfer mb-6 p-4">
          <div className="flex gap-4">
            <div className="h-28 w-24 shrink-0 overflow-hidden rounded-sm border border-line bg-surface2">
              {alvo.cartao.fotoUrl ? (
                <img src={alvo.cartao.fotoUrl} alt={alvo.cartao.nomeCompleto} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-mute/70">sem foto</div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-ink">{alvo.cartao.nomeCompleto}</p>
              <p className="text-xs text-mute">{alvo.cartao.timeNome ?? 'Sem time'}</p>
              {status && (
                <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status]}`}>
                  Mensalidade: {STATUS_LABELS[status]} (vence {formatarData(alvo.cartao.vencimento)})
                </span>
              )}
              <p className="mt-2 text-sm text-mute">
                Saldo: <b className="text-gold">{formatarCreditos(alvo.saldo)} créditos</b>
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            {!alvo.part && (
              <p className="text-sm text-warn">
                Essa pessoa não está inscrita em “{game.nome}”. Quem se inscreve na hora precisa ser adicionada por um
                admin ou tesoureiro em Gerenciar jogos.
              </p>
            )}
            {cancelada && <p className="text-sm text-warn">A inscrição dessa pessoa foi cancelada pela diretoria.</p>}
            {alvo.part?.status === 'espera' && (
              <p className="text-sm text-warn">Essa pessoa está na lista de espera. Promova-a em Gerenciar jogos antes do check-in.</p>
            )}
            {jaPresente && (
              <p className="text-sm text-ok">
                Presença já registrada
                {alvo.part?.presenteEm ? ` às ${new Date(alvo.part.presenteEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                {alvo.part?.checkInPorNome ? ` por ${alvo.part.checkInPorNome}` : ''}.
              </p>
            )}
            {alvo.part?.status === 'ativa' && (
              <div className="space-y-2">
                <button disabled={!podeDebitar || enviando} onClick={() => confirmar('creditos')} className="btn-primary w-full">
                  Debitar {formatarCreditos(game.custoCreditos)} créditos e confirmar presença
                </button>
                {!podeDebitar && (
                  <p className="text-xs text-warn">
                    Saldo insuficiente (faltam {formatarCreditos(game.custoCreditos - alvo.saldo)} créditos).
                  </p>
                )}
                <button disabled={enviando} onClick={() => confirmar('dinheiro')} className="btn-ghost w-full">
                  Recebi {reais(game.valor)} em dinheiro e confirmar presença
                </button>
              </div>
            )}
          </div>

          <button onClick={() => { setAlvo(null); setAviso(null) }} className="mt-3 text-xs text-mute hover:underline">
            Fechar
          </button>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-ink">Lista de inscritos</h2>
      <div className="space-y-1">
        {lista.length === 0 && <p className="text-sm text-mute/70">Ninguém inscrito neste jogo.</p>}
        {lista.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-sm border border-line bg-surface2 px-3 py-2 text-sm">
            <span className="text-ink">{p.jogadorNome}</span>
            {p.status === 'presente' ? (
              <span className="text-xs text-ok">
                presente ·{' '}
                {p.pagoCom === 'creditos' ? `−${formatarCreditos(p.creditosDebitados)} créditos` : 'dinheiro'}
              </span>
            ) : (
              <button onClick={() => processar(p.uid)} className="text-xs text-accent-hi hover:underline">
                Fazer check-in
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
