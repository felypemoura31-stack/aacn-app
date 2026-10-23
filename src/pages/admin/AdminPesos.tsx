import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { SeletorPeso } from '../../components/SeletorPeso'
import { PESO_PADRAO, definirPeso, rotuloDoPeso } from '../../lib/sorteio'

interface Linha {
  uid: string
  nome: string
  time: string | null
}

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Só o admin: o peso de cada jogador no sorteio de times (1 = novato ... 5 = veterano ... 10). Sem peso definido, vale 1. */
export function AdminPesos() {
  const { player: staff } = useAuth()
  const [jogadores, setJogadores] = useState<Linha[] | null>(null)
  const [pesos, setPesos] = useState<Record<string, number>>({})
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<number | 'todos'>('todos')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'publicCards'), orderBy('nomeCompleto')), (snap) =>
      setJogadores(snap.docs.map((d) => ({ uid: d.id, nome: (d.data() as { nomeCompleto: string }).nomeCompleto, time: (d.data() as { timeNome?: string | null }).timeNome ?? null }))),
    )
    const u2 = onSnapshot(collection(db, 'pesos'), (snap) => {
      const m: Record<string, number> = {}
      snap.docs.forEach((d) => (m[d.id] = Number((d.data() as { peso?: number }).peso ?? PESO_PADRAO)))
      setPesos(m)
    })
    return () => {
      u1()
      u2()
    }
  }, [])

  const peso = (uid: string) => pesos[uid] ?? PESO_PADRAO

  const contagem = useMemo(() => {
    const c = new Map<number, number>()
    for (const j of jogadores ?? []) c.set(peso(j.uid), (c.get(peso(j.uid)) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => a[0] - b[0])
  }, [jogadores, pesos]) // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => {
    const q = simples(busca)
    return (jogadores ?? []).filter((j) => (q === '' || simples(j.nome).includes(q) || simples(j.time ?? '').includes(q)) && (filtro === 'todos' || peso(j.uid) === filtro))
  }, [jogadores, busca, filtro, pesos]) // eslint-disable-line react-hooks/exhaustive-deps

  async function mudar(j: Linha, novo: number) {
    if (!staff) return
    setErro(null)
    try {
      await definirPeso({ uid: j.uid, nome: j.nome }, peso(j.uid), novo, { uid: staff.uid, nome: staff.nomeCompleto })
    } catch {
      setErro('Não consegui salvar o peso. Tente de novo.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Pesos do sorteio</h1>
      <p className="mb-4 max-w-2xl text-sm text-mute">
        Só o admin define. O peso diz quanto o jogador pesa no equilíbrio do sorteio de times: <b className="text-ink">1 = novato</b>, <b className="text-ink">5 = veterano</b> (vai até 10). Quem não tem peso definido
        vale 1. Cada mudança fica registrada no Histórico de ações. O jogador não vê o próprio peso.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <button type="button" onClick={() => setFiltro('todos')} className={`rounded-full border px-3 py-1 ${filtro === 'todos' ? 'border-accent-hi bg-accent/15 text-ink' : 'border-line text-mute hover:bg-surface2'}`}>
          Todos ({jogadores?.length ?? 0})
        </button>
        {contagem.map(([p, n]) => (
          <button
            key={p}
            type="button"
            onClick={() => setFiltro(p)}
            className={`rounded-full border px-3 py-1 ${filtro === p ? 'border-accent-hi bg-accent/15 text-ink' : 'border-line text-mute hover:bg-surface2'}`}
          >
            {p} · {rotuloDoPeso(p)} ({n})
          </button>
        ))}
      </div>

      <input type="search" placeholder="Buscar por nome ou time..." value={busca} onChange={(e) => setBusca(e.target.value)} className="input mb-3" />
      {erro && <p className="mb-3 text-sm text-danger">{erro}</p>}
      {jogadores === null && <p className="text-sm text-mute">Carregando...</p>}
      {jogadores && lista.length === 0 && <p className="text-sm text-mute/70">Ninguém encontrado.</p>}

      <ul className="space-y-1.5">
        {lista.map((j) => (
          <li key={j.uid} className="flex items-center gap-3 rounded-sm border border-line bg-surface2 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{j.nome}</span>
              <span className="block truncate text-[11px] text-mute">{j.time ?? 'Sem time'}</span>
            </span>
            <SeletorPeso valor={peso(j.uid)} aoMudar={(n) => mudar(j, n)} />
          </li>
        ))}
      </ul>
    </div>
  )
}
