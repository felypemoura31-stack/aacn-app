import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { CarteirinhaImpressao } from '../../components/CarteirinhaImpressao'
import { useTeam } from '../../lib/useTeam'
import { useContatos } from '../../lib/useContatos'
import { STATUS_COLORS, STATUS_LABELS, statusEfetivo } from '../../lib/status'
import type { JogadorResumo, Player, PlayerStatus } from '../../types'

interface Cartao extends JogadorResumo {
  status: PlayerStatus
  vencimento: number | null
}

/** Admin e tesoureiro: procuram um jogador, veem a carteirinha dele e imprimem. */
export function AdminCarteirinhas() {
  const { uid } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const { player: staff } = useAuth()
  const ehAdmin = staff?.role === 'admin'
  const [cartoes, setCartoes] = useState<Cartao[] | null>(null)
  const [busca, setBusca] = useState('')
  const [cadastro, setCadastro] = useState<Pick<Player, 'dataNascimento' | 'criadoEm'> | null>(null)
  const contatos = useContatos(ehAdmin)

  useEffect(() => {
    return onSnapshot(collection(db, 'publicCards'), (snap) =>
      setCartoes(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Cartao)),
    )
  }, [])

  const escolhido = cartoes?.find((c) => c.uid === uid) ?? null
  const time = useTeam(escolhido?.timeId)

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="no-print">
        <h1 className="mb-1 text-xl font-bold text-ink">Carteirinhas</h1>
        <p className="mb-4 text-sm text-mute">Escolha um jogador para ver a carteirinha dele e imprimir.</p>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou time"
          className="mb-3 w-full rounded-sm border border-line bg-surface2 px-3 py-2 text-ink"
        />

        <div className="mb-6 max-h-64 space-y-1 overflow-y-auto">
          {cartoes === null && <p className="text-sm text-mute">Carregando...</p>}
          {cartoes && lista.length === 0 && <p className="text-sm text-mute/70">Ninguém encontrado.</p>}
          {lista.map((c) => {
            const st = statusEfetivo(c)
            return (
              <button
                key={c.uid}
                onClick={() => navigate(`/admin/carteirinhas/${c.uid}`)}
                className={`flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-sm ${
                  c.uid === uid ? 'border-accent-hi bg-surface2' : 'border-line hover:bg-surface2'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{c.nomeCompleto}</span>
                  <span className="block truncate text-xs text-mute">{c.timeNome ?? 'Sem time'}</span>
                </span>
                <span className={`ml-2 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[st]}`}>
                  {STATUS_LABELS[st]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {uid && cartoes && !escolhido && <p className="no-print text-sm text-danger">Jogador não encontrado.</p>}

      {escolhido && !dados && (
        <p className="no-print rounded-sm border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          {ehAdmin
            ? 'Carregando os dados do cadastro...'
            : 'Os dados de nascimento deste jogador ainda não chegaram à tesouraria. Peça para ele abrir o app uma vez (ou para um admin abrir esta tela) e tente de novo.'}
        </p>
      )}

      {escolhido && dados && (
        <>
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
          />
          <button onClick={() => window.print()} className="no-print mx-auto mt-6 block btn-primary">
            Imprimir carteirinha de {escolhido.nomeCompleto.split(' ')[0]}
          </button>
        </>
      )}
    </div>
  )
}
