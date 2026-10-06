import { useEffect, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { formatarData, paraMillis } from '../../lib/status'
import type { Aviso } from '../../types'

export function AdminAvisos() {
  const { player: staff } = useAuth()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [fixado, setFixado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'avisos'), orderBy('criadoEm', 'desc'))
    return onSnapshot(q, (snap) => setAvisos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso)))
  }, [])

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
                <button onClick={() => deleteDoc(doc(db, 'avisos', a.id))} className="btn-ghost text-danger">
                  Apagar
                </button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-mute">{a.texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
