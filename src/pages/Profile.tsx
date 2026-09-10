import { useEffect, useState, type FormEvent } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { solicitarEntradaNoTime } from '../lib/teams'
import { sincronizarCartaoPublico } from '../lib/publicCard'
import type { Team } from '../types'

export function Profile() {
  const { currentUser, player } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const [nomeCompleto, setNomeCompleto] = useState('')
  const [endereco, setEndereco] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [contatoEmergenciaNome, setContatoEmergenciaNome] = useState('')
  const [contatoEmergenciaTelefone, setContatoEmergenciaTelefone] = useState('')
  const [condicoesMedicas, setCondicoesMedicas] = useState('')
  const [timeSelecionado, setTimeSelecionado] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('nome'))
    return onSnapshot(q, (snap) => {
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team))
    })
  }, [])

  useEffect(() => {
    if (!player) return
    setNomeCompleto(player.nomeCompleto ?? '')
    setEndereco(player.endereco ?? '')
    setDataNascimento(player.dataNascimento ?? '')
    setContatoEmergenciaNome(player.contatoEmergenciaNome ?? '')
    setContatoEmergenciaTelefone(player.contatoEmergenciaTelefone ?? '')
    setCondicoesMedicas(player.condicoesMedicas ?? '')
    setTimeSelecionado(player.timeId ?? '')
  }, [player])

  if (!currentUser || !player) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSavedMessage(null)
    try {
      await updateDoc(doc(db, 'players', currentUser!.uid), {
        nomeCompleto,
        endereco,
        dataNascimento,
        contatoEmergenciaNome,
        contatoEmergenciaTelefone,
        condicoesMedicas,
        atualizadoEm: serverTimestamp(),
      })
      await sincronizarCartaoPublico({ ...player!, nomeCompleto })

      if (timeSelecionado && timeSelecionado !== player!.timeId) {
        const time = teams.find((t) => t.id === timeSelecionado)
        if (time) await solicitarEntradaNoTime({ ...player!, nomeCompleto }, time)
      }

      setSavedMessage('Dados salvos com sucesso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900">Meus dados</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
      >
        <Field label="Nome completo">
          <input
            required
            value={nomeCompleto}
            onChange={(e) => setNomeCompleto(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Endereço">
          <input
            required
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Data de nascimento">
          <input
            type="date"
            required
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Contato de emergência (nome)">
            <input
              required
              value={contatoEmergenciaNome}
              onChange={(e) => setContatoEmergenciaNome(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Contato de emergência (telefone)">
            <input
              required
              value={contatoEmergenciaTelefone}
              onChange={(e) => setContatoEmergenciaTelefone(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="Condições médicas ou especiais">
          <textarea
            value={condicoesMedicas}
            onChange={(e) => setCondicoesMedicas(e.target.value)}
            placeholder="Ex: alergias, restrições, condições relevantes. Deixe em branco se não houver."
            rows={3}
            className="input"
          />
        </Field>

        <Field label="Time">
          <select
            value={timeSelecionado}
            onChange={(e) => setTimeSelecionado(e.target.value)}
            className="input"
          >
            <option value="">Nenhum time</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          {player.timeId && (
            <p className="mt-1 text-xs text-slate-500">
              Status no time atual:{' '}
              {player.timeAprovado ? (
                <span className="font-medium text-green-700">aprovado</span>
              ) : (
                <span className="font-medium text-amber-700">
                  aguardando aprovação do representante
                </span>
              )}
            </p>
          )}
        </Field>

        {savedMessage && (
          <p className="text-sm text-green-700">{savedMessage}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}
