import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { LeitoresDoAviso, type Membro } from '../../components/LeitoresDoAviso'
import { ehFinanceiro } from '../../lib/roles'
import { formatarData, paraMillis } from '../../lib/status'
import type { Aviso } from '../../types'

export function AdminAvisos() {
  const { player: staff } = useAuth()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [fixado, setFixado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [totalMembros, setTotalMembros] = useState<number | null>(null)
  const [membros, setMembros] = useState<Membro[] | null>(null)
  const carregando = useRef(false)

  useEffect(() => {
    const q = query(collection(db, 'avisos'), orderBy('criadoEm', 'desc'))
    return onSnapshot(q, (snap) => setAvisos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso)))
  }, [])

  // quantos associados existem (contagem barata do servidor) para o "lido por N de M"
  useEffect(() => {
    getCountFromServer(collection(db, 'publicCards'))
      .then((s) => setTotalMembros(s.data().count))
      .catch(() => {})
  }, [])

  /** A lista de associados só é baixada quando a diretoria abre "Ver quem leu" pela primeira vez. */
  async function carregarMembros() {
    if (carregando.current || membros) return
    carregando.current = true
    try {
      const cartoes = await getDocs(collection(db, 'publicCards'))
      // a data da conta só a tesouraria enxerga; sem ela, todos contam como "ainda não leu"
      const entrou = new Map<string, number>()
      if (ehFinanceiro(staff)) {
        try {
          for (const c of (await getDocs(collection(db, 'contatos'))).docs) {
            const ms = paraMillis((c.data() as { criadoEm?: unknown }).criadoEm)
            if (ms != null) entrou.set(c.id, ms)
          }
        } catch {
          /* sem acesso: segue sem a data */
        }
      }
      setMembros(cartoes.docs.map((d) => ({ uid: d.id, nome: (d.data() as { nomeCompleto: string }).nomeCompleto, entrouEm: entrou.get(d.id) ?? null })))
    } finally {
      carregando.current = false
    }
  }

  /** Apagar o aviso apaga também o registro de quem leu. */
  async function apagar(a: Aviso) {
    if (!window.confirm(`Apagar o aviso "${a.titulo}"? O registro de quem leu também é apagado.`)) return
    setErro(null)
    try {
      const leituras = await getDocs(query(collection(db, 'avisoLeituras'), where('avisoId', '==', a.id)))
      for (let i = 0; i < leituras.docs.length; i += 400) {
        const lote = writeBatch(db)
        leituras.docs.slice(i, i + 400).forEach((d) => lote.delete(d.ref))
        await lote.commit()
      }
      const lote = writeBatch(db)
      lote.delete(doc(db, 'avisos', a.id))
      await lote.commit()
    } catch {
      setErro('Não foi possível apagar o aviso.')
    }
  }

  async function publicar(e: FormEvent) {
    e.preventDefault()
    if (!staff) return
    setErro(null)
    try {
      await addDoc(collection(db, 'avisos'), {
        titulo: titulo.trim(),
        texto: texto.trim(),
        fixado,
        autorUid: staff.uid,
        autorNome: staff.nomeCompleto,
        criadoEm: serverTimestamp(),
      })
      setTitulo('')
      setTexto('')
      setFixado(false)
    } catch {
      setErro('Não foi possível publicar o aviso.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Avisos</h1>

      <form onSubmit={publicar} className="panel mb-8 space-y-3 p-4">
        <h2 className="text-sm font-bold text-ink">Novo aviso</h2>
        <input required maxLength={100} placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" />
        <textarea
          required
          maxLength={1000}
          rows={4}
          placeholder="Mensagem para todos os associados"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="input"
        />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={fixado} onChange={(e) => setFixado(e.target.checked)} />
          Fixar no topo
        </label>
        {erro && <p className="text-sm text-danger">{erro}</p>}
        <button type="submit" className="btn-primary">
          Publicar
        </button>
      </form>

      <div className="space-y-2">
        {avisos.length === 0 && <p className="text-sm text-mute/70">Nenhum aviso publicado.</p>}
        {avisos.map((a) => (
          <div key={a.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {a.fixado && <span className="mr-2 text-[10px] uppercase tracking-widest text-gold">fixado</span>}
                  {a.titulo}
                </p>
                <p className="text-[11px] text-mute/80">
                  {formatarData(paraMillis(a.criadoEm))} · {a.autorNome}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => updateDoc(doc(db, 'avisos', a.id), { fixado: !a.fixado })} className="btn-ghost">
                  {a.fixado ? 'Desafixar' : 'Fixar'}
                </button>
                <button onClick={() => apagar(a)} className="btn-ghost text-danger">
                  Apagar
                </button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-mute">{a.texto}</p>
            <LeitoresDoAviso aviso={a} totalMembros={totalMembros} membros={membros} aoAbrir={carregarMembros} />
          </div>
        ))}
      </div>
    </div>
  )
}
