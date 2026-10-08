import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { desfazerAjuste, formatarCreditos, type Autor } from '../lib/credits'
import { paraMillis } from '../lib/status'
import type { LedgerEntry, LedgerTipo } from '../types'

const ROTULO: Record<LedgerTipo, string> = {
  pagamento: 'Pagamento',
  jogo: 'Jogo',
  estorno: 'Estorno',
  ajuste: 'Ajuste',
  bonus: 'Bônus',
  estorno_pagamento: 'Pix estornado',
}

/** `autor` só vem na tela da tesouraria: com ele, os ajustes manuais ganham o botão "Desfazer". */
export function ExtratoCreditos({ uid, autor = null }: { uid: string; autor?: Autor | null }) {
  const [itens, setItens] = useState<LedgerEntry[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [desfazendo, setDesfazendo] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'ledger'), where('uid', '==', uid))
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry)
      setItens(lista.sort((a, b) => (paraMillis(b.criadoEm) ?? 0) - (paraMillis(a.criadoEm) ?? 0)))
    })
  }, [uid])

  // ajustes que já têm o lançamento contrário ("desfazer_<id>", com o id do original em refId)
  const desfeitos = useMemo(() => new Set((itens ?? []).filter((i) => i.id.startsWith('desfazer_')).map((i) => i.refId)), [itens])

  async function desfazer(i: LedgerEntry) {
    if (!autor) return
    const sinal = i.creditos >= 0 ? '+' : '−'
    if (
      !window.confirm(
        `Desfazer o ajuste "${i.descricao}" (${sinal}${formatarCreditos(Math.abs(i.creditos))} créditos)?\n\nO extrato ganha um lançamento contrário (${i.creditos >= 0 ? '−' : '+'}${formatarCreditos(Math.abs(i.creditos))}); o ajuste original continua registrado.`,
      )
    )
      return
    setErro(null)
    setDesfazendo(i.id)
    try {
      await desfazerAjuste(i, autor)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setDesfazendo(null)
    }
  }

  if (itens === null) return <p className="text-sm text-mute">Carregando extrato...</p>
  if (itens.length === 0) return <p className="text-sm text-mute/70">Nenhuma movimentação ainda.</p>

  return (
    <>
      {erro && <p className="mb-2 text-sm text-danger">{erro}</p>}
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
            {itens.map((i) => {
              const ajusteManual = i.tipo === 'ajuste' && i.refId == null
              const jaDesfeito = desfeitos.has(i.id)
              return (
                <tr key={i.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-mute">
                    {paraMillis(i.criadoEm) ? new Date(paraMillis(i.criadoEm)!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-mute">{ROTULO[i.tipo]}</td>
                  <td className="px-3 py-2 text-ink">
                    <span className={jaDesfeito ? 'text-mute line-through' : ''}>{i.descricao}</span>
                    {jaDesfeito && <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-mute">desfeito</span>}
                    {i.porUid !== i.uid && <span className="block text-[10px] text-mute/70">por {i.porNome}</span>}
                    {autor && ajusteManual && !jaDesfeito && (
                      <button
                        type="button"
                        disabled={desfazendo === i.id}
                        onClick={() => desfazer(i)}
                        className="mt-1 rounded-sm border border-danger/40 px-2 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        {desfazendo === i.id ? 'Desfazendo...' : 'Desfazer'}
                      </button>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${i.creditos >= 0 ? 'text-ok' : 'text-danger'}`}>
                    {i.creditos >= 0 ? '+' : '−'}
                    {formatarCreditos(Math.abs(i.creditos))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-gold">{formatarCreditos(i.saldoApos)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
