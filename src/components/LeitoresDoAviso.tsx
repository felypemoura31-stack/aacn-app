import { useEffect, useMemo, useState } from 'react'
import { collection, getCountFromServer, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { formatarData, paraMillis } from '../lib/status'
import type { Aviso, AvisoLeitura } from '../types'

export interface Membro {
  uid: string
  nome: string
  /** Dia em que a pessoa criou a conta, quando a tesouraria enxerga (a organização não). */
  entrouEm: number | null
}

/**
 * Quem já tocou em "Lido" neste aviso, com dia e hora, e quem ainda não leu. A contagem vem do servidor (barata); a lista
 * só é carregada quando a diretoria abre.
 *
 * Quem criou a conta DEPOIS de um aviso comum não o recebe (só os fixados aparecem para quem entrou depois), então não
 * conta como "ainda não leu". Isso só é possível quando se sabe a data da conta (admin e tesoureiro).
 */
export function LeitoresDoAviso({ aviso, totalMembros, membros, aoAbrir }: { aviso: Aviso; totalMembros: number | null; membros: Membro[] | null; aoAbrir: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [leram, setLeram] = useState<number | null>(null)
  const [leitores, setLeitores] = useState<AvisoLeitura[] | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vivo = true
    getCountFromServer(query(collection(db, 'avisoLeituras'), where('avisoId', '==', aviso.id)))
      .then((s) => vivo && setLeram(s.data().count))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [aviso.id])

  useEffect(() => {
    if (!aberto) return
    return onSnapshot(query(collection(db, 'avisoLeituras'), where('avisoId', '==', aviso.id)), (snap) => setLeitores(snap.docs.map((d) => d.data() as AvisoLeitura)))
  }, [aberto, aviso.id])

  const ordenados = useMemo(
    () => [...(leitores ?? [])].sort((a, b) => (paraMillis(b.lidoEm) ?? 0) - (paraMillis(a.lidoEm) ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR')),
    [leitores],
  )

  const { faltam, depois } = useMemo(() => {
    if (!membros || !leitores) return { faltam: [] as Membro[], depois: 0 }
    const leu = new Set(leitores.map((l) => l.uid))
    const quando = paraMillis(aviso.criadoEm) ?? 0
    let depois = 0
    const faltam: Membro[] = []
    for (const m of membros) {
      if (leu.has(m.uid)) continue
      if (!aviso.fixado && m.entrouEm != null && m.entrouEm > quando) {
        depois++
        continue
      }
      faltam.push(m)
    }
    faltam.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return { faltam, depois }
  }, [membros, leitores, aviso])

  function abrirOuFechar() {
    if (!aberto) aoAbrir()
    setAberto((v) => !v)
  }

  async function copiarQuemFalta() {
    const texto = `Aviso "${aviso.titulo}" — ainda não leram (${faltam.length}):\n` + faltam.map((m) => `• ${m.nome}`).join('\n')
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const quantos = aberto && leitores ? leitores.length : leram

  return (
    <div className="mt-3 border-t border-line pt-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-mute">
          Lido por <b className="text-ink">{quantos ?? '...'}</b>
          {totalMembros != null ? ` de ${totalMembros}` : ''} associado(s)
        </p>
        <button type="button" onClick={abrirOuFechar} className="text-accent-hi underline">
          {aberto ? 'Esconder quem leu' : 'Ver quem leu'}
        </button>
      </div>

      {aberto && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-widest text-ok">Leram ({ordenados.length})</p>
            {leitores === null && <p className="text-mute/70">Carregando...</p>}
            {leitores && ordenados.length === 0 && <p className="text-mute/70">Ninguém marcou como lido ainda.</p>}
            <ul className="space-y-0.5">
              {ordenados.map((l) => {
                const ms = paraMillis(l.lidoEm)
                return (
                  <li key={l.uid} className="flex justify-between gap-2 text-mute">
                    <span className="truncate text-ink">{l.nome}</span>
                    <span className="shrink-0 text-[11px]">
                      {ms ? `${formatarData(ms)} às ${new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'antes do registro'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <p className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-widest text-warn">
              <span>Ainda não leram ({membros && leitores ? faltam.length : '...'})</span>
              {faltam.length > 0 && (
                <button type="button" onClick={copiarQuemFalta} className="normal-case tracking-normal text-mute underline hover:text-ink">
                  {copiado ? 'Copiado!' : 'Copiar nomes'}
                </button>
              )}
            </p>
            {(!membros || !leitores) && <p className="text-mute/70">Carregando...</p>}
            {membros && leitores && faltam.length === 0 && <p className="text-mute/70">Todos já leram.</p>}
            <ul className="space-y-0.5">
              {faltam.map((m) => (
                <li key={m.uid} className="truncate text-mute">
                  {m.nome}
                </li>
              ))}
            </ul>
            {depois > 0 && (
              <p className="mt-2 text-[11px] text-mute/70">
                {depois} {depois === 1 ? 'pessoa entrou' : 'pessoas entraram'} depois deste aviso e não o {depois === 1 ? 'recebeu' : 'receberam'} (só avisos fixados aparecem para quem
                entra depois).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
