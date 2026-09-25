import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { DIA_MS, CICLO_DIAS, STATUS_LABELS, formatarData, statusEfetivo } from '../../lib/status'
import { sincronizarCartaoPublico } from '../../lib/publicCard'
import type { Player, PlayerStatus, UserRole } from '../../types'

export function AdminPlayerDetail() {
  const { uid } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'players', uid)).then((snap) => {
      setPlayer(snap.exists() ? (snap.data() as Player) : null)
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
      await updateDoc(doc(db, 'players', uid), {
        ...player,
        atualizadoEm: serverTimestamp(),
      })
      await sincronizarCartaoPublico(player)
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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/admin" className="text-sm text-mute hover:underline">
        &larr; Voltar para lista
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-bold text-ink">
        {player.nomeCompleto || '(sem nome)'}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 panel p-5"
      >
        <div className="flex gap-4">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded border border-line bg-surface2">
            {player.fotoUrl && (
              <img
                src={player.fotoUrl}
                alt={player.nomeCompleto}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex-1 space-y-3">
            <Field label="Nome completo">
              <input
                value={player.nomeCompleto}
                onChange={(e) => setField('nomeCompleto', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="E-mail">
              <input value={player.email} disabled className="input bg-surface2 text-mute/70" />
            </Field>
          </div>
        </div>

        <Field label="Endereço">
          <input
            value={player.endereco}
            onChange={(e) => setField('endereco', e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Data de nascimento">
          <input
            type="date"
            value={player.dataNascimento}
            onChange={(e) => setField('dataNascimento', e.target.value)}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Contato de emergência (nome)">
            <input
              value={player.contatoEmergenciaNome}
              onChange={(e) => setField('contatoEmergenciaNome', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Contato de emergência (telefone)">
            <input
              value={player.contatoEmergenciaTelefone}
              onChange={(e) =>
                setField('contatoEmergenciaTelefone', e.target.value)
              }
              className="input"
            />
          </Field>
        </div>

        <Field label="Condições médicas ou especiais">
          <textarea
            value={player.condicoesMedicas}
            onChange={(e) => setField('condicoesMedicas', e.target.value)}
            rows={3}
            className="input"
          />
        </Field>

        <Field label="Time">
          <input
            value={player.timeNome ?? ''}
            disabled
            className="input bg-surface2 text-mute/70"
          />
          <p className="mt-1 text-xs text-mute">
            Gerencie a entrada em times em Admin: Times.
          </p>
        </Field>

        <Field label="Status de pagamento">
          <select
            value={statusEfetivo(player)}
            onChange={(e) => mudarStatus(e.target.value as PlayerStatus)}
            className="input"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-mute">
            Vencimento: {formatarData(player.vencimento)} (o status muda sozinho quando vence).
            Para registrar um pagamento recebido, use Admin: Pagamentos.
          </p>
        </Field>

        <Field label="Papel no sistema">
          <select
            value={player.role}
            onChange={(e) => setField('role', e.target.value as UserRole)}
            className="input"
          >
            <option value="player">Jogador</option>
            <option value="admin">Administrador</option>
          </select>
        </Field>

        {savedMessage && <p className="text-sm text-ok">{savedMessage}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-sm btn-primary"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="btn-ghost"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}
