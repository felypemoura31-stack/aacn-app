import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { ExtratoCreditos } from '../../components/ExtratoCreditos'
import { adminAjustarSaldo, formatarCreditos } from '../../lib/credits'
import type { JogadorResumo, Wallet } from '../../types'

export function AdminCredits() {
  const { player: admin } = useAuth()
  const [players, setPlayers] = useState<JogadorResumo[]>([])
  const [carteiras, setCarteiras] = useState<Record<string, Wallet>>({})
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [modo, setModo] = useState<'extrato' | 'ajuste'>('extrato')
  const [sinal, setSinal] = useState<'+' | '-'>('+')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'publicCards'), orderBy('nomeCompleto')), (snap) =>
      setPlayers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as JogadorResumo)),
    )
    const unsubW = onSnapshot(collection(db, 'wallets'), (snap) => {
      const m: Record<string, Wallet> = {}
      snap.docs.forEach((d) => (m[d.id] = d.data() as Wallet))
      setCarteiras(m)
    })
    return () => {
      unsubP()
      unsubW()
    }
  }, [])

  const filtrados = useMemo(
    () => players.filter((p) => p.nomeCompleto?.toLowerCase().includes(busca.toLowerCase())),
    [players, busca],
  )

  function abrir(uid: string, m: 'extrato' | 'ajuste') {
    if (aberto === uid && modo === m) {
      setAberto(null)
      return
    }
    setAberto(uid)
    setModo(m)
    setErro(null)
    setOk(null)
  }

  async function ajustar(e: FormEvent, jogador: JogadorResumo) {
    e.preventDefault()
    if (!admin) return
    setErro(null)
    setOk(null)
    setEnviando(true)
    try {
      const n = Number(valor.replace(',', '.'))
      if (!(n > 0)) throw new Error('Informe uma quantidade maior que zero')
      await adminAjustarSaldo(jogador, sinal === '+' ? n : -n, motivo, {
        uid: admin.uid,
        nome: admin.nomeCompleto,
      })
      setOk('Ajuste registrado no extrato.')
      setValor('')
      setMotivo('')
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Créditos</h1>

      <input
        placeholder="Buscar jogador..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="input mb-4 max-w-xs"
      />

      <div className="space-y-2">
        {filtrados.map((p) => (
          <div key={p.uid} className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{p.nomeCompleto}</p>
                <p className="text-xs text-mute">{p.timeNome ?? 'Sem time'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gold">
                  {formatarCreditos(carteiras[p.uid]?.creditos ?? 0)}
                </span>
                <button onClick={() => abrir(p.uid, 'extrato')} className="btn-ghost">
                  Extrato
                </button>
                <button onClick={() => abrir(p.uid, 'ajuste')} className="btn-primary">
                  Ajustar
                </button>
              </div>
            </div>

            {aberto === p.uid && modo === 'extrato' && (
              <div className="mt-4">
                <ExtratoCreditos uid={p.uid} />
              </div>
            )}

            {aberto === p.uid && modo === 'ajuste' && (
              <form onSubmit={(e) => ajustar(e, p)} className="mt-4 space-y-3 border-t border-line pt-4">
                <div className="flex gap-2">
                  <select value={sinal} onChange={(e) => setSinal(e.target.value as '+' | '-')} className="input w-auto">
                    <option value="+">Adicionar (+)</option>
                    <option value="-">Remover (−)</option>
                  </select>
                  <input
                    required
                    inputMode="decimal"
                    placeholder="Créditos"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="input"
                  />
                </div>
                <input
                  required
                  placeholder="Motivo (fica registrado no extrato)"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="input"
                />
                {erro && <p className="text-sm text-danger">{erro}</p>}
                {ok && <p className="text-sm text-ok">{ok}</p>}
                <button type="submit" disabled={enviando} className="btn-primary">
                  Registrar ajuste
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
