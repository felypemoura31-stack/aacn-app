import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { PhotoUploader } from '../components/PhotoUploader'
import { solicitarEntradaNoTime } from '../lib/teams'
import { sincronizarCartaoPublico } from '../lib/publicCard'
import { dataNascimentoValida, ehMenor, faltasDoCadastro, formatarTelefone, telefoneValido } from '../lib/cadastro'
import { VERSAO_TERMOS } from '../lib/termos'
import { linkDaRede } from '../lib/redes'
import { comMensagem } from '../lib/whatsapp'
import type { Team } from '../types'

export function Profile() {
  const { currentUser, player } = useAuth()
  const navigate = useNavigate()
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const [nomeCompleto, setNomeCompleto] = useState('')
  const [endereco, setEndereco] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [celular, setCelular] = useState('')
  const [contatoEmergenciaNome, setContatoEmergenciaNome] = useState('')
  const [contatoEmergenciaTelefone, setContatoEmergenciaTelefone] = useState('')
  const [condicoesMedicas, setCondicoesMedicas] = useState('')
  const [timeSelecionado, setTimeSelecionado] = useState('')
  const [respNome, setRespNome] = useState('')
  const [respTel, setRespTel] = useState('')
  const [respAutoriza, setRespAutoriza] = useState(false)
  const [aceitaTermo, setAceitaTermo] = useState(false)

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
    setCelular(formatarTelefone(player.celular ?? ''))
    setContatoEmergenciaNome(player.contatoEmergenciaNome ?? '')
    setContatoEmergenciaTelefone(formatarTelefone(player.contatoEmergenciaTelefone ?? ''))
    setCondicoesMedicas(player.condicoesMedicas ?? '')
    setTimeSelecionado(player.timeId ?? '')
    setRespNome(player.responsavelLegalNome ?? '')
    setRespTel(formatarTelefone(player.responsavelLegalTelefone ?? ''))
    setRespAutoriza(!!player.responsavelLegalAutoriza)
  }, [player])

  if (!currentUser || !player) return null

  const faltas = faltasDoCadastro(player)

  // Se o time tem WhatsApp no perfil, o jogador pode avisar o pedido de entrada por lá.
  const timeAtual = teams.find((t) => t.id === player.timeId)
  const zapTime = timeAtual?.redes?.whatsapp ? linkDaRede('whatsapp', timeAtual.redes.whatsapp) : null
  const urlAvisoTime =
    zapTime && timeAtual
      ? comMensagem(zapTime, `Olá! Sou ${player.nomeCompleto} e pedi para entrar no time ${timeAtual.nome} pelo app da AACN. Pode aprovar meu pedido?`)
      : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErroForm(null)
    if (!dataNascimentoValida(dataNascimento)) return setErroForm('Informe uma data de nascimento válida.')
    if (!telefoneValido(celular)) return setErroForm('Informe o celular com DDD, por exemplo (64) 99999-9999.')
    if (!telefoneValido(contatoEmergenciaTelefone)) return setErroForm('Informe o telefone do contato de emergência com DDD.')
    const menor = ehMenor({ dataNascimento })
    if (menor && !respNome.trim()) return setErroForm('Informe o nome do responsável legal (menor de 18 anos).')
    if (menor && !telefoneValido(respTel)) return setErroForm('Informe o telefone do responsável legal com DDD.')
    if (menor && !respAutoriza) return setErroForm('O responsável legal precisa autorizar a participação do menor.')
    setSaving(true)
    setSavedMessage(null)
    try {
      await updateDoc(doc(db, 'players', currentUser!.uid), {
        nomeCompleto,
        endereco,
        dataNascimento,
        celular,
        contatoEmergenciaNome,
        contatoEmergenciaTelefone,
        condicoesMedicas,
        responsavelLegalNome: menor ? respNome.trim() : '',
        responsavelLegalTelefone: menor ? respTel : '',
        responsavelLegalAutoriza: menor ? respAutoriza : false,
        atualizadoEm: serverTimestamp(),
      })
      await sincronizarCartaoPublico({ ...player!, nomeCompleto })
      await setDoc(doc(db, 'contatos', currentUser!.uid), { celular, atualizadoEm: serverTimestamp() })

      if (timeSelecionado && timeSelecionado !== player!.timeId) {
        const time = teams.find((t) => t.id === timeSelecionado)
        if (time) await solicitarEntradaNoTime({ ...player!, nomeCompleto }, time)
      }

      setSavedMessage('Dados salvos com sucesso.')
      if (faltasDoCadastro({ ...player!, nomeCompleto, endereco, dataNascimento, celular, contatoEmergenciaNome, contatoEmergenciaTelefone, responsavelLegalNome: respNome, responsavelLegalTelefone: respTel, responsavelLegalAutoriza: respAutoriza }).length === 0) {
        navigate('/')
      }
    } finally {
      setSaving(false)
    }
  }

  async function aceitarTermo() {
    await updateDoc(doc(db, 'players', currentUser!.uid), {
      aceiteTermosVersao: VERSAO_TERMOS,
      aceiteTermosEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
  }

  async function handleFoto(dataUrl: string) {
    await updateDoc(doc(db, 'players', currentUser!.uid), {
      fotoUrl: dataUrl,
      atualizadoEm: serverTimestamp(),
    })
    await sincronizarCartaoPublico({ ...player!, fotoUrl: dataUrl })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Meus dados</h1>

      {faltas.length > 0 && (
        <div className="mb-6 rounded-sm border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          <p className="font-semibold">Complete seu cadastro para continuar.</p>
          <p className="mt-1 text-xs">
            O preenchimento dos dados pessoais é obrigatório para usar a carteirinha, os jogos e o time. Faltam:{' '}
            {faltas.join(', ')}.
          </p>
        </div>
      )}

      {player.aceiteTermosVersao !== VERSAO_TERMOS && (
        <div className="panel mb-6 p-5">
          <h2 className="mb-2 text-sm font-semibold text-ink">Termo de responsabilidade e privacidade</h2>
          <p className="mb-3 text-sm text-mute">
            {player.aceiteTermosVersao
              ? 'O termo foi atualizado. Leia e aceite novamente para continuar.'
              : 'Leia e aceite o termo de responsabilidade e a política de privacidade da AACN para continuar.'}
          </p>
          <label className="mb-3 flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={aceitaTermo} onChange={(e) => setAceitaTermo(e.target.checked)} className="mt-1" />
            <span>
              Li e aceito o{' '}
              <Link to="/termos" target="_blank" className="underline">
                termo de responsabilidade e a política de privacidade
              </Link>
              .
            </span>
          </label>
          <button type="button" disabled={!aceitaTermo} onClick={aceitarTermo} className="btn-primary">
            Aceitar
          </button>
        </div>
      )}

      <div className="panel mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Foto 3x4 (obrigatória)</h2>
        <PhotoUploader currentUrl={player.fotoUrl} onChange={handleFoto} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 panel p-5"
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

        <Field label="Celular (com DDD)">
          <input
            required
            type="tel"
            inputMode="numeric"
            placeholder="(64) 99999-9999"
            value={celular}
            onChange={(e) => setCelular(formatarTelefone(e.target.value))}
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
              type="tel"
              inputMode="numeric"
              placeholder="(64) 99999-9999"
              value={contatoEmergenciaTelefone}
              onChange={(e) => setContatoEmergenciaTelefone(formatarTelefone(e.target.value))}
              className="input"
            />
          </Field>
        </div>

        {ehMenor({ dataNascimento }) && (
          <div className="space-y-3 rounded-sm border border-warn/40 bg-warn/5 p-4">
            <p className="text-sm font-semibold text-warn">Menor de 18 anos: dados do responsável legal</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do responsável legal">
                <input value={respNome} onChange={(e) => setRespNome(e.target.value)} maxLength={80} className="input" />
              </Field>
              <Field label="Telefone do responsável">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="(64) 99999-9999"
                  value={respTel}
                  onChange={(e) => setRespTel(formatarTelefone(e.target.value))}
                  className="input"
                />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={respAutoriza} onChange={(e) => setRespAutoriza(e.target.checked)} className="mt-1" />
              <span>
                Sou o responsável legal, autorizo a participação do menor nas atividades da AACN e concordo com o termo de responsabilidade.
              </span>
            </label>
          </div>
        )}

        <Field label="Condições médicas ou especiais (opcional)">
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
            <p className="mt-1 text-xs text-mute">
              Status no time atual:{' '}
              {player.timeAprovado ? (
                <span className="font-medium text-ok">aprovado</span>
              ) : (
                <span className="font-medium text-warn">
                  aguardando aprovação do representante
                </span>
              )}
              {!player.timeAprovado && urlAvisoTime && (
                <>
                  {' '}
                  <a href={urlAvisoTime} target="_blank" rel="noopener noreferrer" className="underline">
                    Avisar o time pelo WhatsApp
                  </a>
                </>
              )}
            </p>
          )}
        </Field>

        {erroForm && <p className="text-sm text-danger">{erroForm}</p>}

        {savedMessage && (
          <p className="text-sm text-ok">{savedMessage}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-sm btn-primary"
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
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}
