import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { PainelCheckin } from './PainelCheckin'
import { temCargo } from '../lib/roles'

/**
 * Check-in de jogos na tela inicial, para quem tem cargo de admin, tesoureiro ou organizador. Abre sozinho quando há
 * jogo hoje; fora disso fica recolhido numa linha (um toque abre).
 */
export function CheckinNaTelaInicial() {
  const { player } = useAuth()
  const permitido = temCargo(player, 'admin') || temCargo(player, 'tesoureiro') || temCargo(player, 'organizador')
  const [aberto, setAberto] = useState(false)
  const tocou = useRef(false) // se a pessoa abriu/fechou na mão, o app não mexe mais

  useEffect(() => {
    if (!permitido) return
    return onSnapshot(collection(db, 'games'), (snap) => {
      const d = new Date()
      const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!tocou.current && snap.docs.some((g) => (g.data() as { data?: string }).data === hoje)) setAberto(true)
    })
  }, [permitido])

  if (!permitido) return null

  return (
    <section className="no-print panel mb-6" aria-label="Check-in de jogos">
      <button
        type="button"
        onClick={() => {
          tocou.current = true
          setAberto((v) => !v)
        }}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink">Check-in de jogos</span>
          <span className="block text-xs text-mute">Ler o QR da carteirinha, confirmar a presença e debitar os créditos</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-accent-hi">{aberto ? 'Recolher ▲' : 'Abrir ▼'}</span>
      </button>
      {aberto && (
        <div className="border-t border-line p-4">
          <PainelCheckin compacto />
        </div>
      )}
    </section>
  )
}
