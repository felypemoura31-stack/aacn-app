import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { DIA_MS, CICLO_DIAS, STATUS_LABELS, formatarData, paraMillis, statusEfetivo } from '../../lib/status'
import { sincronizarCartaoPublico } from '../../lib/publicCard'
import { rotulosDosCargos } from '../../lib/roles'
import { GerirConquistas } from '../../components/GerirConquistas'
import { ResetJogador } from '../../components/ResetJogador'
import { CpfEmUsoError, trocarCpf } from '../../lib/cpf'
import { ExcluirJogador } from '../../components/ExcluirJogador'
import { formatarCep, formatarCpf, formatarTelefone, soDigitos } from '../../lib/cadastro'
import type { Player, PlayerStatus } from '../../types'

export function AdminPlayerDetail() {
  const { uid } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [cpfInicial, setCpfInicial] = useState('')
  const [original, setOriginal] = useState<Player | null>(null) // como estava quando a ficha foi aberta/salva
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'players', uid)).then((snap) => {
      setPlayer(snap.exists() ? (snap.data() as Player) : null)
      setCpfInicial(snap.exists() ? ((snap.data() as Player).cpf ?? '') : '')
      setOriginal(snap.exists() ? (snap.data() as Player) : null)
      setLoading(false)
    })
  }, [uid])

  if (loading) return <div className="px-4 py-8 text-mute">Carregando...</div>
  if (!player) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-danger">Jogador não encontrado.</p>
        <Link to="/admin" className="text-sm text-mute underline">
          Voltar
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!player || !uid) return
    setSaving(true)
    setSavedMessage(null)
    try {
      // Só os campos que esta ficha edita, e só os que mudaram. Cargo, time e o resto do cadastro não vão aqui:
      // a ficha pode estar aberta há tempo e regravá-los desfaria o que mudou nesse meio tempo (ex.: aprovação no time).
      const editaveis = ['nomeCompleto', 'endereco', 'bairro', 'cep', 'celular', 'dataNascimento', 'contatoEmergenciaNome', 'contatoEmergenciaTelefone', 'condicoesMedicas', 'status', 'vencimento'] as const
      const alterados: Record<string, unknown> = {}
      for (const k of editaveis) {
        if ((player[k] ?? null) !== (original?.[k] ?? null)) alterados[k] = player[k] ?? null
      }
      // o CPF é único: a troca vai antes, junto com o documento do CPF
      if ((player.cpf ?? '') !== cpfInicial) {
        try {
          await trocarCpf(uid, cpfInicial, player.cpf ?? '')
          setCpfInicial(player.cpf ?? '')
        } catch (e) {
          if (e instanceof CpfEmUsoError) return setSavedMessage('Este CPF já está cadastrado em outra conta.')
          throw e
        }
      }
      if (Object.keys(alterados).length > 0) {
        await updateDoc(doc(db, 'players', uid), { ...alterados, atualizadoEm: serverTimestamp() })
      }
      // o cartão público sai do cadastro ATUAL (não da cópia da tela), para não perder time/situação mudados por outros
      const atual = await getDoc(doc(db, 'players', uid))
      if (atual.exists()) {
        const p = atual.data() as Player
        await sincronizarCartaoPublico(p)
        setPlayer(p)
        setOriginal(p)
        setCpfInicial(p.cpf ?? '')
      }
      setSavedMessage('Alterações salvas.')
    } finally {
      setSaving(false)
    }
  }

  function mudarStatus(novo: PlayerStatus) {
    setPlayer((prev) => {
      if (!prev) return prev
      const agora = Date.now()
      let vencimento = prev.vencimento
      if (novo === 'pago' && !(vencimento != null && vencimento > agora)) {
        vencimento = agora + CICLO_DIAS * DIA_MS
      }
      if (novo === 'inadimplente' && vencimento != null && vencimento > agora) {
        vencimento = agora
      }
      return { ...prev, status: novo, vencimento }
    })
  }

  function setField<K extends keyof Player>(key: K, value: Player[K]) {
    setPlayer((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to="/admin" className="text-xs text-mute hover:underline">
            &larr; Jogadores
          </Link>
          <h1 className="truncate text-xl font-bold text-ink">{player.nomeCompleto || '(sem nome)'}</h1>
        </div>
        <Link to={`/admin/carteirinhas/${player.uid}`} className="btn-ghost">
          Ver e imprimir a carteirinha
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="panel space-y-4 p-5">
          <div className="flex gap-4">
            <div className="h-24 w-20 shrink-0 overflow-hidden rounded border border-line bg-surface2">
              {player.fotoUrl && <img src={player.fotoUrl} alt={player.nomeCompleto} className="h-full w-full object-cover" />}
            </div>
            <div className="grid flex-1 content-start gap-3 sm:grid-cols-2">
              <Field label="Nome completo">
                <input value={player.nomeCompleto} onChange={(e) => setField('nomeCompleto', e.target.value)} className="input" />
              </Field>
              <Field label="E-mail">
                <input value={player.email} disabled className="input text-mute/70" />
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="CPF">
              <input
                value={formatarCpf(player.cpf ?? '')}
                onChange={(e) => setField('cpf', soDigitos(e.target.value).slice(0, 11))}
                placeholder="000.000.000-00"
                className="input"
              />
            </Field>
            <Field label="Nascimento">
              <input type="date" value={player.dataNascimento} onChange={(e) => setField('dataNascimento', e.target.value)} className="input" />
            </Field>
            <Field label="Celular">
              <input value={player.celular ?? ''} onChange={(e) => setField('celular', formatarTelefone(e.target.value))} className="input" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem]">
            <Field label="Endereço">
              <input value={player.endereco} onChange={(e) => setField('endereco', e.target.value)} className="input" />
            </Field>
            <Field label="Bairro">
              <input value={player.bairro ?? ''} onChange={(e) => setField('bairro', e.target.value)} className="input" />
            </Field>
            <Field label="CEP">
              <input value={player.cep ?? ''} onChange={(e) => setField('cep', formatarCep(e.target.value))} className="input" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contato de emergência">
              <input value={player.contatoEmergenciaNome} onChange={(e) => setField('contatoEmergenciaNome', e.target.value)} className="input" />
            </Field>
            <Field label="Telefone do contato">
              <input value={player.contatoEmergenciaTelefone} onChange={(e) => setField('contatoEmergenciaTelefone', e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Condições médicas ou especiais">
            <textarea value={player.condicoesMedicas} onChange={(e) => setField('condicoesMedicas', e.target.value)} rows={2} className="input" />
          </Field>

          {savedMessage && <p className="text-sm text-ok">{savedMessage}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-sm btn-primary">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button type="button" onClick={() => navigate('/admin')} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </div>

        <aside className="panel space-y-4 p-5">
          <Field label="Situação da mensalidade">
            <select value={statusEfetivo(player)} onChange={(e) => mudarStatus(e.target.value as PlayerStatus)} className="input">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-mute">Vence em {formatarData(player.vencimento)}. Pagamento recebido: Admin → Pagamentos.</p>
          </Field>

          <dl className="space-y-2 border-t border-line pt-4 text-sm">
            <Info rotulo="Time" valor={player.timeNome ? (player.timeAprovado ? player.timeNome : `${player.timeNome} (pendente)`) : 'Sem time'} />
            <Info rotulo="Cargos" valor={rotulosDosCargos(player)} />
            <Info
              rotulo="Termo"
              valor={player.aceiteTermosVersao ? `Aceito em ${formatarData(paraMillis(player.aceiteTermosEm))}` : 'Ainda não aceitou'}
            />
            {player.responsavelLegalNome && (
              <Info
                rotulo="Responsável legal"
                valor={`${player.responsavelLegalNome} · ${player.responsavelLegalTelefone ?? ''} · ${player.responsavelLegalAutoriza ? 'autorizou' : 'sem autorização'}`}
              />
            )}
          </dl>
          <p className="text-[11px] text-mute/80">Time: Admin → Times. Cargo: Admin → Cargos (o de administrador, só no Firebase).</p>
        </aside>
      </form>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <GerirConquistas uid={player.uid} nome={player.nomeCompleto || 'este jogador'} />

        <details className="panel group">
          <summary className="cursor-pointer select-none px-5 py-3 text-sm font-bold text-danger">Zona de risco (resetar e excluir)</summary>
          <div className="space-y-4 px-5 pb-5">
            <ResetJogador
              uid={player.uid}
              nome={player.nomeCompleto || 'este jogador'}
              aoTerminar={() =>
                getDoc(doc(db, 'players', player.uid)).then((snap) => snap.exists() && setPlayer(snap.data() as Player))
              }
            />
            {player.role !== 'admin' && (
              <ExcluirJogador uid={player.uid} nome={player.nomeCompleto || 'este jogador'} aoExcluir={() => navigate('/admin')} />
            )}
          </div>
        </details>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-mute">{label}</span>
      {children}
    </label>
  )
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-mute">{rotulo}</dt>
      <dd className="text-right text-ink">{valor}</dd>
    </div>
  )
}
