import { useEffect, useState, type FormEvent } from 'react'
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { confirmarPagamento } from '../../lib/payments'
import { formatarData, paraMillis } from '../../lib/status'
import { gerarPixCopiaECola, normalizarChavePix, tipoDaChavePix } from '../../lib/pix'
import type { Payment, PixConfig } from '../../types'

const hoje = () => new Date().toISOString().slice(0, 10)
const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export function AdminPayments() {
  const { player: admin } = useAuth()
  const [cfg, setCfg] = useState<PixConfig>({ chave: '', nome: '', cidade: '', valor: 5 })
  const [cfgMsg, setCfgMsg] = useState<string | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [datas, setDatas] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const podeEditarPix = admin?.role === 'admin'

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'pix'), (snap) => {
      if (snap.exists()) setCfg(snap.data() as PixConfig)
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'payments'), orderBy('criadoEm', 'desc'))
    return onSnapshot(q, (snap) => {
      setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment))
    })
  }, [])

  async function salvarCfg(e: FormEvent) {
    e.preventDefault()
    // grava a chave já no formato que os bancos esperam (e-mail em minúsculas, CPF só com números…)
    const chave = normalizarChavePix(cfg.chave)
    await setDoc(doc(db, 'config', 'pix'), { ...cfg, chave, valor: Number(cfg.valor) })
    setCfg((c) => ({ ...c, chave }))
    setCfgMsg('Configuração salva.')
  }

  async function confirmar(p: Payment) {
    if (!admin) return
    setBusyId(p.id)
    setErro(null)
    try {
      const [y, m, d] = (datas[p.id] ?? hoje()).split('-').map(Number)
      await confirmarPagamento(p, new Date(y, m - 1, d, 12).getTime(), {
        uid: admin.uid,
        nome: admin.nomeCompleto,
      })
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const pendentes = payments.filter((p) => p.status === 'pendente')
  const confirmados = payments.filter((p) => p.status === 'confirmado')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-ink">Pagamentos</h1>

      <form onSubmit={salvarCfg} className="panel mb-8 p-4">
        <fieldset disabled={!podeEditarPix} className="space-y-3">
        <h2 className="text-sm font-bold text-ink">Chave Pix da associação</h2>
        {!podeEditarPix && (
          <p className="text-xs text-mute">Somente o administrador altera a chave e o valor.</p>
        )}
        <input
          required
          placeholder="Chave Pix (e-mail, CPF/CNPJ, telefone ou aleatória)"
          value={cfg.chave}
          onChange={(e) => setCfg({ ...cfg, chave: e.target.value })}
          className="input"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            placeholder="Nome do recebedor (máx. 25)"
            maxLength={25}
            value={cfg.nome}
            onChange={(e) => setCfg({ ...cfg, nome: e.target.value })}
            className="input"
          />
          <input
            required
            placeholder="Cidade (máx. 15)"
            maxLength={15}
            value={cfg.cidade}
            onChange={(e) => setCfg({ ...cfg, cidade: e.target.value })}
            className="input"
          />
        </div>
        <label className="block text-sm text-mute">
          Valor da mensalidade (R$)
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={cfg.valor}
            onChange={(e) => setCfg({ ...cfg, valor: Number(e.target.value) })}
            className="input mt-1"
          />
        </label>
        {cfg.chave.trim() && (
          <p className="text-xs text-mute">
            Chave enviada ao banco: <b className="text-ink">{normalizarChavePix(cfg.chave)}</b> ({tipoDaChavePix(cfg.chave)}).
            O app corrige maiúsculas, espaços e pontuação sozinho.
          </p>
        )}
        {cfgMsg && <p className="text-sm text-ok">{cfgMsg}</p>}
        {podeEditarPix && (
          <button type="submit" className="btn-primary">
            Salvar
          </button>
        )}
        </fieldset>
      </form>

      {cfg.chave.trim() && cfg.nome.trim() && cfg.cidade.trim() && Number(cfg.valor) > 0 && (
        <div className="panel mb-8 p-4">
          <h2 className="text-sm font-bold text-ink">Testar o Pix copia e cola</h2>
          <p className="mt-1 text-xs text-mute">
            Cole este código no app do seu banco (Pix → Pix Copia e Cola) e confira se aparece o nome do recebedor e o valor de{' '}
            {reais(Number(cfg.valor))}. É o mesmo formato que os jogadores recebem.
          </p>
          <textarea
            readOnly
            rows={4}
            value={gerarPixCopiaECola({ ...cfg, valor: Number(cfg.valor) }, 'TESTE')}
            onFocus={(e) => e.currentTarget.select()}
            className="input mt-2 break-all font-mono text-xs"
          />
          <button
            type="button"
            className="btn-ghost mt-2"
            onClick={() => navigator.clipboard.writeText(gerarPixCopiaECola({ ...cfg, valor: Number(cfg.valor) }, 'TESTE'))}
          >
            Copiar código de teste
          </button>
        </div>
      )}

      {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}
      <h2 className="mb-2 text-sm font-semibold text-ink">Aguardando confirmação</h2>
      {pendentes.length === 0 && (
        <p className="mb-6 text-sm text-mute/70">Nenhuma cobrança pendente.</p>
      )}
      <div className="mb-8 space-y-2">
        {pendentes.map((p) => (
          <div
            key={p.id}
            className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-ink">{p.jogadorNome}</p>
              <p className="text-xs text-mute">
                {reais(p.valor)} · {p.txid}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                max={hoje()}
                value={datas[p.id] ?? hoje()}
                onChange={(e) => setDatas({ ...datas, [p.id]: e.target.value })}
                className="input w-auto"
              />
              <button disabled={busyId === p.id} onClick={() => confirmar(p)} className="btn-primary">
                Confirmar
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">Histórico</h2>
      <div className="space-y-2">
        {confirmados.map((p) => (
          <div
            key={p.id}
            className="flex justify-between rounded-sm border border-line bg-surface2 px-4 py-2 text-sm text-mute"
          >
            <span>
              {p.jogadorNome} · {reais(p.valor)}
            </span>
            <span className="text-ok">pago em {formatarData(paraMillis(p.dataPagamento))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
