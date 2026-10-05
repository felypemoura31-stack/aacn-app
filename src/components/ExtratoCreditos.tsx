import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { formatarCreditos } from '../lib/credits'
import type { LedgerEntry, LedgerTipo } from '../types'

const ROTULO: Record<LedgerTipo, string> = {
  pagamento: 'Pagamento',
  jogo: 'Jogo',
  estorno: 'Estorno',
  ajuste: 'Ajuste',
}

export function ExtratoCreditos({ uid }: { uid: string }) {
  const [itens, setItens] = useState<LedgerEntry[] | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'ledger'), where('uid', '==', uid))
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry)
      setItens(lista.sort((a, b) => b.criadoEm - a.criadoEm))
    })
  }, [uid])

  if (itens === null) return <p className="text-sm text-mute">Carregando extrato...</p>
  if (itens.length === 0) return <p className="text-sm text-mute/70">Nenhuma movimentação ainda.</p>

  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-surface">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface2 uppercase text-mute">
          <tr>
            <th className="px-3 py-2">Data</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Descrição</th>
            <th className="px-3 py-2 text-right">Créditos</th>
            <th className="px-3 py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id} className="border-t border-line align-top">
              <td className="whitespace-nowrap px-3 py-2 text-mute">
                {new Date(i.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td className="px-3 py-2 text-mute">{ROTULO[i.tipo]}</td>
              <td className="px-3 py-2 text-ink">
                {i.descricao}
                {i.porUid !== i.uid && <span className="block text-[10px] text-mute/70">por {i.porNome}</span>}
              </td>
              <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${i.creditos >= 0 ? 'text-ok' : 'text-danger'}`}>
                {i.creditos >= 0 ? '+' : '−'}
                {formatarCreditos(Math.abs(i.creditos))}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-gold">{formatarCreditos(i.saldoApos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
