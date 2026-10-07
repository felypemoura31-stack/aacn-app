import { useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { CONQUISTAS, concederConquista, contextoDoJogador, type DefConquista } from '../lib/conquistas'
import { formatarCreditos } from '../lib/credits'
import { paraMillis } from '../lib/status'
import type { Estatisticas, Player } from '../types'

interface Pendencia {
  uid: string
  nome: string
  conquista: DefConquista
}

/**
 * Admin: procura jogadores que já atingiram uma conquista (pelos contadores e pelo cadastro) e ainda não a
 * receberam, e concede todas de uma vez com o bônus. O "Assíduo" fica de fora (depende de faltas, que só o
 * app do jogador calcula).
 */
export function ConferirConquistas() {
  const { player: admin } = useAuth()
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [concedendo, setConcedendo] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (admin?.role !== 'admin') return null

  async function conferir() {
    setCarregando(true)
    setMsg(null)
    try {
      const [jogadores, estatisticas, concedidas] = await Promise.all([
        getDocs(collection(db, 'players')),
        getDocs(collection(db, 'stats')),
        getDocs(collection(db, 'conquistas')),
      ])
      const stats = new Map(estatisticas.docs.map((d) => [d.id, d.data() as Estatisticas]))
      const jaTem = new Set(concedidas.docs.map((d) => `${d.id}`))
      const lista: Pendencia[] = []
      for (const d of jogadores.docs) {
        const p = d.data() as Player
        const ctx = contextoDoJogador(p, stats.get(d.id) ?? null, 0, paraMillis(p.criadoEm))
        for (const c of CONQUISTAS) {
          if (c.id === 'assiduo' || !c.ok(ctx) || jaTem.has(`${d.id}_${c.id}`)) continue
          lista.push({ uid: d.id, nome: p.nomeCompleto?.trim() || '(sem nome)', conquista: c })
        }
      }
      setPendencias(lista)
      if (lista.length === 0) setMsg('Tudo certo: ninguém tem conquista atingida e pendente.')
    } finally {
      setCarregando(false)
    }
  }

  async function concederTodas() {
    if (!pendencias || !admin) return
    const total = pendencias.reduce((s, p) => s + p.conquista.bonus, 0)
    if (!window.confirm(`Conceder ${pendencias.length} conquista(s), somando ${formatarCreditos(total)} créditos? O bônus entra no saldo e no extrato de cada jogador.`)) return
    setConcedendo(true)
    setMsg(null)
    let feitas = 0
    const falhas: string[] = []
    for (const p of pendencias) {
      try {
        await concederConquista({ uid: p.uid, nome: p.nome }, p.conquista, true, { uid: admin.uid, nome: admin.nomeCompleto })
        feitas++
      } catch (e) {
        falhas.push(`${p.nome} (${p.conquista.titulo}): ${e instanceof Error ? e.message : 'erro'}`)
      }
    }
    setConcedendo(false)
    setPendencias(null)
    setMsg(`${feitas} conquista(s) concedida(s).${falhas.length ? ` Falharam: ${falhas.join('; ')}` : ''}`)
  }

  return (
    <div className="mb-4">
      <button
        onClick={conferir}
        disabled={carregando || concedendo}
        title="Acha quem já atingiu uma conquista e não recebeu (por exemplo, Parte de um time) e concede com o bônus"
        className="text-xs text-mute underline hover:text-ink"
      >
        {carregando ? 'Conferindo...' : 'Conferir conquistas pendentes'}
      </button>

      {msg && <p className="mt-2 text-sm text-ok">{msg}</p>}

      {pendencias && pendencias.length > 0 && (
        <div className="panel mt-2 p-4">
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {pendencias.map((p) => (
              <li key={p.uid + p.conquista.id} className="flex justify-between gap-3 text-mute">
                <span className="min-w-0 truncate text-ink">{p.nome}</span>
                <span className="shrink-0">
                  {p.conquista.titulo} · +{formatarCreditos(p.conquista.bonus)}
                </span>
              </li>
            ))}
          </ul>
          <button onClick={concederTodas} disabled={concedendo} className="btn-primary mt-3">
            {concedendo ? 'Concedendo...' : `Conceder as ${pendencias.length}`}
          </button>
        </div>
      )}
    </div>
  )
}
