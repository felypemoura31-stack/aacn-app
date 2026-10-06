import { useRef, useState, type FormEvent } from 'react'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { reduzirLogo } from '../lib/foto'
import { CATEGORIAS_PARCEIRO } from '../lib/parceiros'
import { urlHttp } from '../lib/redes'
import { formatarTelefone, telefoneValido } from '../lib/cadastro'
import type { Partner } from '../types'

interface Props {
  parceiro: Partner | null // null = novo
  onClose: () => void
}

export function PartnerEditor({ parceiro, onClose }: Props) {
  const [nome, setNome] = useState(parceiro?.nome ?? '')
  const [categoria, setCategoria] = useState(parceiro?.categoria ?? CATEGORIAS_PARCEIRO[0])
  const [desconto, setDesconto] = useState(parceiro?.desconto ?? '')
  const [descricao, setDescricao] = useState(parceiro?.descricao ?? '')
  const [endereco, setEndereco] = useState(parceiro?.endereco ?? '')
  const [telefone, setTelefone] = useState(parceiro?.telefone ?? '')
  const [instagram, setInstagram] = useState(parceiro?.link ?? '')
  const [ativo, setAtivo] = useState(parceiro?.ativo ?? true)
  const [logoUrl, setLogoUrl] = useState<string | null>(parceiro?.logoUrl ?? null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro(null)
    try {
      setLogoUrl(await reduzirLogo(file))
    } catch (err) {
      setErro((err as Error).message)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const link = instagram.trim()
    if (link && !urlHttp(link)) return setErro('O link (Instagram/site) precisa ser um endereço http/https válido.')
    if (telefone.trim() && !telefoneValido(telefone)) return setErro('Informe o telefone com DDD.')

    setSalvando(true)
    try {
      const dados = {
        nome: nome.trim(),
        categoria,
        desconto: desconto.trim(),
        descricao: descricao.trim() || null,
        endereco: endereco.trim() || null,
        telefone: telefone.trim() || null,
        link: link ? urlHttp(link) : null,
        logoUrl,
        ativo,
      }
      if (parceiro) await updateDoc(doc(db, 'partners', parceiro.id), dados)
      else await addDoc(collection(db, 'partners'), { ...dados, criadoEm: serverTimestamp() })
      onClose()
    } catch {
      setErro('Não foi possível salvar o parceiro.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4">
      <form onSubmit={salvar} className="panel my-4 w-full max-w-lg space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">{parceiro ? 'Editar parceiro' : 'Novo parceiro'}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="px-2 text-lg leading-none text-mute hover:text-ink">
            ×
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-slate-400">Sem logo</span>}
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={escolherLogo}
              className="max-w-full text-sm text-mute file:mr-3 file:rounded-sm file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            />
            {logoUrl && (
              <button type="button" onClick={() => setLogoUrl(null)} className="mt-1 block text-xs text-danger hover:underline">
                Remover logo
              </button>
            )}
          </div>
        </div>

        <input required maxLength={80} placeholder="Nome do estabelecimento" value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
          {CATEGORIAS_PARCEIRO.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input required maxLength={120} placeholder="Benefício (ex: 10% em todos os produtos)" value={desconto} onChange={(e) => setDesconto(e.target.value)} className="input" />
        <textarea maxLength={500} rows={3} placeholder="Descrição / condições do desconto" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" />
        <input maxLength={160} placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="input" />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Telefone / WhatsApp"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
            className="input"
          />
          <input maxLength={200} placeholder="Instagram ou site (link)" value={instagram} onChange={(e) => setInstagram(e.target.value)} className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Parceria ativa (aparece para os associados)
        </label>

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
