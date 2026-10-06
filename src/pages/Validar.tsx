import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { LeitorQr } from '../components/LeitorQr'
import { CartaoVerificado, type CartaoPublico } from '../components/CartaoVerificado'

/** Tira o código do associado do que foi lido: o link do QR (…/verificar/<código>) ou o próprio código. */
export function extrairCodigo(texto: string) {
  const t = texto.trim()
  const m = t.match(/\/verificar\/([A-Za-z0-9_-]{6,128})/)
  if (m) return m[1]
  return /^[A-Za-z0-9_-]{6,128}$/.test(t) ? t : null
}

type Resultado = { card: CartaoPublico } | { erro: string }

/**
 * Validador para o parceiro: abre sem login, lê o QR da carteirinha do cliente e mostra
 * na hora a foto, o nome, o time e se o associado está adimplente.
 */
export function Validar() {
  const [lendo, setLendo] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [codigo, setCodigo] = useState('')

  async function validar(texto: string) {
    const uid = extrairCodigo(texto)
    if (!uid) {
      setLendo(false)
      setResultado({ erro: 'Esse QR code não é de uma carteirinha da AACN.' })
      return
    }
    setLendo(false)
    setCarregando(true)
    setResultado(null)
    try {
      const snap = await getDoc(doc(db, 'publicCards', uid))
      setResultado(snap.exists() ? { card: snap.data() as CartaoPublico } : { erro: 'Carteirinha não encontrada.' })
    } catch {
      setResultado({ erro: 'Não consegui consultar agora. Verifique a internet e tente de novo.' })
    } finally {
      setCarregando(false)
    }
  }

  function enviarCodigo(e: FormEvent) {
    e.preventDefault()
    if (codigo.trim()) validar(codigo)
  }

  function novaLeitura() {
    setResultado(null)
    setCodigo('')
    setLendo(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="chamfer w-full max-w-sm panel p-6 text-center">
        <img src="/logo.png" alt="AACN" className="mx-auto mb-3 h-16 w-16 rounded-full ring-2 ring-accent-hi/60" />
        <h1 className="text-lg font-bold text-ink">Validador de carteirinha</h1>
        <p className="mb-4 text-xs uppercase tracking-widest text-mute">para parceiros da AACN</p>

        {!lendo && !resultado && !carregando && (
          <>
            <p className="mb-4 text-sm text-mute">
              Aponte a câmera para o QR code da carteirinha do cliente. Não precisa de login.
            </p>
            <button onClick={() => setLendo(true)} className="btn-primary w-full">
              Ler QR code
            </button>
          </>
        )}

        {lendo && (
          <>
            <LeitorQr onLeitura={validar} pausado={carregando} />
            <button onClick={() => setLendo(false)} className="btn-ghost mt-3 w-full">
              Cancelar
            </button>
          </>
        )}

        {carregando && <p className="text-mute">Consultando...</p>}

        {resultado && 'erro' in resultado && <p className="mb-4 text-danger">{resultado.erro}</p>}
        {resultado && 'card' in resultado && <CartaoVerificado card={resultado.card} />}
        {resultado && (
          <button onClick={novaLeitura} className="btn-primary mt-5 w-full">
            Ler outra carteirinha
          </button>
        )}

        {!lendo && (
          <form onSubmit={enviarCodigo} className="mt-6 border-t border-line pt-4 text-left">
            <label className="mb-1 block text-xs text-mute" htmlFor="codigo">
              A câmera não abre? Cole o link ou o código da carteirinha
            </label>
            <div className="flex gap-2">
              <input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="https://…/verificar/…"
                className="min-w-0 flex-1 rounded-sm border border-line bg-surface2 px-3 py-2 text-sm text-ink"
              />
              <button className="btn-ghost" type="submit">
                Ver
              </button>
            </div>
          </form>
        )}

        <Link to="/login" className="mt-5 block text-xs text-mute underline hover:text-ink">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
