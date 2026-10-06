import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { removerMembroDoTime } from '../lib/teams'
import { TeamEditor } from '../components/TeamEditor'
import { TeamLogo } from './Teams'
import { useTeam } from '../lib/useTeam'
import { REDES, linkDaRede } from '../lib/redes'
import type { JogadorResumo, RedeSocial } from '../types'

function dataBr(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function tempoDeExistencia(iso: string) {
  const ini = new Date(iso + 'T12:00')
  const hoje = new Date()
  let anos = hoje.getFullYear() - ini.getFullYear()
  if (hoje.getMonth() < ini.getMonth() || (hoje.getMonth() === ini.getMonth() && hoje.getDate() < ini.getDate())) anos--
  if (anos >= 1) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  const meses = Math.max(0, (hoje.getFullYear() - ini.getFullYear()) * 12 + hoje.getMonth() - ini.getMonth())
  return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

export function TeamProfile() {
  const { id } = useParams<{ id: string }>()
  const { currentUser, player } = useAuth()
  const team = useTeam(id)
  const [membros, setMembros] = useState<JogadorResumo[] | null>(null)
  const [editando, setEditando] = useState(false)
  const [rep, setRep] = useState<JogadorResumo | null>(null)

  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'publicCards'), where('timeId', '==', id))
    return onSnapshot(q, (snap) =>
      setMembros(
        snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }) as JogadorResumo)
          .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto)),
      ),
    )
  }, [id])

  useEffect(() => {
    if (!team?.representanteUid) return setRep(null)
    return onSnapshot(doc(db, 'publicCards', team.representanteUid), (snap) =>
      setRep(snap.exists() ? ({ uid: snap.id, ...snap.data() } as JogadorResumo) : null),
    )
  }, [team?.representanteUid])

  if (!team) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-mute">Carregando time...</p>
        <Link to="/times" className="text-sm text-accent-hi hover:underline">
          Voltar para Times
        </Link>
      </div>
    )
  }

  const ehAdmin = player?.role === 'admin'
  const ehRepresentante = !!currentUser && team.representanteUid === currentUser.uid

  async function remover(m: JogadorResumo) {
    if (!window.confirm(`Tirar ${m.nomeCompleto} do time ${team!.nome}? Ele fica sem time e, para voltar, precisa pedir de novo e ser aprovado.`)) return
    try {
      await removerMembroDoTime(m.uid, team!.id)
    } catch {
      window.alert('Não consegui remover agora. Tente de novo.')
    }
  }
  const redesAtivas = REDES.filter((r) => team.redes?.[r.id])
  // membros aprovados + o representante (que lidera o time mesmo sem pedido aprovado)
  const lista =
    membros === null ? null : rep && !membros.some((m) => m.uid === rep.uid) ? [rep, ...membros] : membros

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/times" className="text-sm text-mute hover:underline">
        &larr; Todos os times
      </Link>

      <div className="panel chamfer mt-3 p-5">
        <div className="flex flex-wrap items-start gap-5">
          <TeamLogo team={team} className="h-28 w-28" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-ink">{team.nome}</h1>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-mute/80">Cidade</dt>
                <dd className="text-ink">{team.cidade || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-mute/80">Criação do time</dt>
                <dd className="text-ink">
                  {team.dataCriacao ? `${dataBr(team.dataCriacao)} (${tempoDeExistencia(team.dataCriacao)})` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-mute/80">Responsável</dt>
                <dd className="text-ink">{team.responsavelNome || team.representanteNome || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-mute/80">Membros</dt>
                <dd className="text-ink">{lista?.length ?? '…'}</dd>
              </div>
            </dl>

            {redesAtivas.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {redesAtivas.map((r) => {
                  const link = linkDaRede(r.id as RedeSocial, team.redes![r.id]!)
                  return link ? (
                    <a
                      key={r.id}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-surface2"
                    >
                      {r.label}
                    </a>
                  ) : null
                })}
              </div>
            )}

            {(ehAdmin || ehRepresentante) && (
              <button onClick={() => setEditando(true)} className="btn-primary mt-4">
                Editar time
              </button>
            )}
          </div>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink">Membros</h2>
      {lista === null && <p className="text-sm text-mute">Carregando...</p>}
      {lista?.length === 0 && <p className="text-sm text-mute/70">Este time ainda não tem membros aprovados.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {lista?.map((m) => {
          const foto = m.fotoUrl
          return (
            <div key={m.uid} className="panel p-3 text-center">
              <div className="mx-auto mb-2 h-24 w-[4.5rem] overflow-hidden rounded-sm border border-line bg-surface2">
                {foto ? (
                  <img src={foto} alt={m.nomeCompleto} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-mute/70">sem foto</span>
                )}
              </div>
              <p className="text-sm font-medium leading-tight text-ink">{m.nomeCompleto}</p>
              {team.representanteUid === m.uid && <p className="mt-1 text-[10px] uppercase tracking-widest text-gold">Representante</p>}
              {(ehAdmin || ehRepresentante) && team.representanteUid !== m.uid && (
                <button onClick={() => remover(m)} className="mt-2 text-[11px] text-danger hover:underline">
                  Remover do time
                </button>
              )}
            </div>
          )
        })}
      </div>

      {editando && <TeamEditor team={team} podeEditarNome={ehAdmin} onClose={() => setEditando(false)} />}
    </div>
  )
}
