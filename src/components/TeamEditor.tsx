import { useState, type FormEvent } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { TeamLogoEditor } from './TeamLogoEditor'
import { useTeam } from '../lib/useTeam'
import { REDES, linkDaRede } from '../lib/redes'
import type { RedeSocial, RedesDoTime, Team } from '../types'

interface Props {
  team: Team
  /** Só o admin muda o nome do time. */
  podeEditarNome: boolean
  onClose: () => void
}

/** Janela de edição do perfil do time: dados, redes sociais e logo. */
export function TeamEditor({ team, podeEditarNome, onClose }: Props) {
  const [nome, setNome] = useState(team.nome)
  const [dataCriacao, setDataCriacao] = useState(team.dataCriacao ?? '')
  const [cidade, setCidade] = useState(team.cidade ?? '')
  const [responsavel, setResponsavel] = useState(team.responsavelNome ?? '')
  const [redes, setRedes] = useState<RedesDoTime>(team.redes ?? {})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const vivo = useTeam(team.id)

  function alternarRede(id: RedeSocial, ligada: boolean) {
    setRedes((r) => {
      const novo = { ...r }
      if (ligada) novo[id] = novo[id] ?? ''
      else delete novo[id]
      return novo
    })
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (dataCriacao && new Date(dataCriacao + 'T12:00').getTime() > Date.now()) {
      return setErro('A data de criação do time não pode ser no futuro.')
    }
    const redesLimpas: RedesDoTime = {}
    for (const [id, valor] of Object.entries(redes) as [RedeSocial, string][]) {
      const v = valor.trim()
      if (!v) continue
      if (!linkDaRede(id, v)) {
        const rotulo = REDES.find((r) => r.id === id)?.label ?? id
        return setErro(`O endereço informado para ${rotulo} não é válido.`)
      }
      redesLimpas[id] = v
    }

    setSalvando(true)
    try {
      const dados: Record<string, unknown> = {
        dataCriacao: dataCriacao || null,
        cidade: cidade.trim() || null,
        responsavelNome: responsavel.trim() || null,
        redes: Object.keys(redesLimpas).length ? redesLimpas : null,
      }
      if (podeEditarNome && nome.trim()) dados.nome = nome.trim()
      await updateDoc(doc(db, 'teams', team.id), dados)
      onClose()
    } catch {
      setErro('Não foi possível salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4">
      <form onSubmit={salvar} className="panel my-4 w-full max-w-lg space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Editar time</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="px-2 text-lg leading-none text-mute hover:text-ink">
            ×
          </button>
        </div>

        <TeamLogoEditor team={vivo ?? team} />

        {podeEditarNome && (
          <label className="block text-sm text-mute">
            Nome do time
            <input required value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className="input mt-1" />
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-mute">
            Data de criação do time
            <input type="date" value={dataCriacao} onChange={(e) => setDataCriacao(e.target.value)} className="input mt-1" />
          </label>
          <label className="block text-sm text-mute">
            Cidade
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} placeholder="Caldas Novas - GO" className="input mt-1" />
          </label>
        </div>

        <label className="block text-sm text-mute">
          Nome do responsável pelo time
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} maxLength={80} className="input mt-1" />
        </label>

        <fieldset>
          <legend className="mb-1 text-sm text-mute">Redes sociais (marque as que o time tem)</legend>
          <div className="space-y-2">
            {REDES.map((r) => {
              const ligada = r.id in redes
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2">
                  <label className="flex w-32 shrink-0 items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={ligada} onChange={(e) => alternarRede(r.id, e.target.checked)} />
                    {r.label}
                  </label>
                  {ligada && (
                    <input
                      value={redes[r.id] ?? ''}
                      onChange={(e) => setRedes((x) => ({ ...x, [r.id]: e.target.value }))}
                      maxLength={200}
                      placeholder={r.placeholder}
                      className="input min-w-0 flex-1"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>

        {erro && <p className="text-sm text-danger">{erro}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn-primary">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
