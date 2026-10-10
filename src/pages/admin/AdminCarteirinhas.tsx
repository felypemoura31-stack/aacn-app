import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { CarteirinhaImpressao } from '../../components/CarteirinhaImpressao'
import { PreviaCarteirinha } from '../../components/PreviaCarteirinha'
import { useContatos } from '../../lib/useContatos'
import { STATUS_COLORS, STATUS_LABELS, statusEfetivo } from '../../lib/status'
import type { JogadorResumo, Player, PlayerStatus, Team } from '../../types'

interface Cartao extends JogadorResumo {
  status: PlayerStatus
  vencimento: number | null
}

/** Admin e tesoureiro: veem a frente da carteirinha de todos, em grade, e abrem uma para imprimir. */
export function AdminCarteirinhas() {
  const { uid } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const { player: staff } = useAuth()
  const ehAdmin = staff?.role === 'admin'
  const [cartoes, setCartoes] = useState<Cartao[] | null>(null)
  const [times, setTimes] = useState<Record<string, Team>>({})
  const [busca, setBusca] = useState('')
  const [cadastro, setCadastro] = useState<Pick<Player, 'dataNascimento' | 'criadoEm'> | null>(null)
  const contatos = useContatos(ehAdmin)

  useEffect(() => {
    return onSnapshot(collection(db, 'publicCards'), (snap) =>
      setCartoes(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Cartao)),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'teams'), (snap) => {
      const m: Record<string, Team> = {}
      snap.docs.forEach((d) => (m[d.id] = { id: d.id, ...d.data() } as Team))
      setTimes(m)
    })
  }, [])

  const escolhido = cartoes?.find((c) => c.uid === uid) ?? null
  const time = escolhido?.timeId ? times[escolhido.timeId] : null

  // O admin lê o cadastro (dados sempre atuais); o tesoureiro usa a cópia da tesouraria.
  useEffect(() => {
    setCadastro(null)
    if (!uid || !ehAdmin) return
    getDoc(doc(db, 'players', uid)).then((s) => s.exists() && setCadastro(s.data() as Player))
  }, [uid, ehAdmin])

  const dados = ehAdmin ? cadastro : contatos[uid ?? ''] && contatos[uid ?? ''].dataNascimento !== undefined
    ? { dataNascimento: contatos[uid!].dataNascimento ?? '', criadoEm: contatos[uid!].criadoEm as number }
    : null

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (cartoes ?? [])
      .filter((c) => !q || c.nomeCompleto.toLowerCase().includes(q) || (c.timeNome ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'))
  }, [cartoes, busca])

  function abrir(id: string) {
    navigate(`/admin/carteirinhas/${id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function aoTeclar(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      abrir(id)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="no-print">
        <h1 className="mb-1 text-xl font-bold text-ink">Carteirinhas</h1>
        <p className="mb-4 text-sm text-mute">Toque numa carteirinha para ampliar e imprimir.</p>
      </div>

      {uid && cartoes && !escolhido && <p className="no-print mb-4 text-sm text-danger">Jogador não encontrado.</p>}

      {escolhido && !dados && (
        <p className="no-print mb-6 rounded-sm border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          {ehAdmin
            ? 'Carregando os dados do cadastro...'
            : 'Os dados de nascimento deste jogador ainda não chegaram à tesouraria. Peça para ele abrir o app uma vez (ou para um admin abrir esta tela) e tente de novo.'}
        </p>
      )}

      {escolhido && dados && (
        <div className="mb-8 border-b border-line pb-8">
          <CarteirinhaImpressao
            player={{
              nomeCompleto: escolhido.nomeCompleto,
              fotoUrl: escolhido.fotoUrl ?? null,
              dataNascimento: dados.dataNascimento,
              criadoEm: dados.criadoEm,
              timeAprovado: !!escolhido.timeId,
            }}
            verifyUrl={`${window.location.origin}/verificar/${escolhido.uid}`}
            timeNome={time?.nome ?? escolhido.timeNome}
            timeLogoUrl={time?.logoUrl ?? null}
            destaques={escolhido.destaques}
          />
          <div className="no-print mt-6 flex flex-wrap justify-center gap-2">
            <button onClick={() => window.print()} className="btn-primary">
              Imprimir carteirinha de {escolhido.nomeCompleto.split(' ')[0]}
            </button>
            <button onClick={() => navigate('/admin/carteirinhas')} className="btn-ghost">
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="no-print">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou time"
          className="mb-4 w-full rounded-sm border border-line bg-surface2 px-3 py-2 text-ink"
        />

        {cartoes === null && <p className="text-sm text-mute">Carregando...</p>}
        {cartoes && lista.length === 0 && <p className="text-sm text-mute/70">Ninguém encontrado.</p>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {lista.map((c) => {
            const st = statusEfetivo(c)
            const sel = c.uid === uid
            const t = c.timeId ? times[c.timeId] : null
            return (
              <div
                key={c.uid}
                role="button"
                tabIndex={0}
                aria-label={`Ampliar e imprimir a carteirinha de ${c.nomeCompleto}`}
                onClick={() => abrir(c.uid)}
                onKeyDown={(e) => aoTeclar(e, c.uid)}
                className={`cursor-pointer rounded-sm border p-1.5 transition hover:bg-surface2 ${sel ? 'border-accent-hi bg-surface2 ring-1 ring-accent-hi' : 'border-line'}`}
              >
                <PreviaCarteirinha
                  player={{
                    nomeCompleto: c.nomeCompleto,
                    fotoUrl: c.fotoUrl ?? null,
                    dataNascimento: contatos[c.uid]?.dataNascimento ?? '',
                    criadoEm: contatos[c.uid]?.criadoEm as number,
                    timeAprovado: !!c.timeId,
                  }}
                  verifyUrl={`${window.location.origin}/verificar/${c.uid}`}
                  timeNome={t?.nome ?? c.timeNome}
                  timeLogoUrl={t?.logoUrl ?? null}
                  destaques={c.destaques}
                />
                <div className="mt-1.5 flex justify-end">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[st]}`}>{STATUS_LABELS[st]}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
