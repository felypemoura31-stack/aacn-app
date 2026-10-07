import { useEffect, useState, type FormEvent } from 'react'
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { confirmarPagamento } from '../../lib/payments'
import { cancelarCobrancaComComprovante } from '../../lib/comprovante'
import { VerComprovante } from '../../components/VerComprovante'
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
  const [verTodos, setVerTodos] = useState(false)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<Payment | null>(null)
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

  async function cancelarCobranca(p: Payment) {
    if (!window.confirm(`Cancelar a cobrança de ${reais(p.valor)} de ${p.jogadorNome}? Nada é creditado e o jogador pode gerar outro Pix quando quiser.`)) return
    setBusyId(p.id)
    setErro(null)
    try {
      await cancelarCobrancaComComprovante(p.id, !!p.comprovanteEm)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setBusyId(null)
    }
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

  const termo = busca.trim().toLowerCase()
  const pendentes = payments
    .filter((p) => p.status === 'pendente')
    .filter((p) => !termo || [p.jogadorNome, p.txid, p.idTransacao ?? ''].some((c) => c.toLowerCase().includes(termo)))
    .sort((a, b) => Number(!!b.comprovanteEm) - Number(!!a.comprovanteEm))
  const mesmoId = (p: Payment) => (p.idTransacao ? payments.filter((o) => o.id !== p.id && o.idTransacao === p.idTransacao) : [])
  const confirmados = payments.filter((p) => p.status === 'confirmado')

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-ink">Pagamentos</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
      {erro && <p className="mb-4 text-sm text-danger">{erro}</p>}
      <h2 className="mb-1 text-sm font-semibold text-ink">Aguardando confirmação</h2>
      <p className="mb-2 text-xs text-mute">
        Confirme quando o Pix cair na conta (os que têm comprovante vêm primeiro), ou cancele a cobrança se o jogador desistiu de pagar.
      </p>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, código de identificação ou ID da transação"
        className="input mb-3"
      />
      {pendentes.length === 0 && (
        <p className="mb-6 text-sm text-mute/70">Nenhuma cobrança pendente.</p>
      )}
      <div className="mb-8 space-y-2">
        {pendentes.map((p) => (
          <div
            key={p.id}
            className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{p.jogadorNome}</p>
              <p className="break-all text-xs text-mute">
                {reais(p.valor)} · <span className="font-mono">{p.txid}</span>
              </p>
              {p.comprovanteEm ? (
                <p className="mt-1 text-xs">
                  <button type="button" onClick={() => setAberto(p)} className="font-semibold text-ok underline">
                    Ver comprovante
                  </button>
                  {p.idTransacao && <span className="ml-2 font-mono text-[11px] text-mute">{p.idTransacao}</span>}
                  {mesmoId(p).length > 0 && <span className="ml-2 text-warn">ID repetido!</span>}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-mute/70">sem comprovante</p>
              )}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
              <button disabled={busyId === p.id} onClick={() => cancelarCobranca(p)} className="btn-ghost text-danger">
                Cancelar cobrança
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">Histórico</h2>
      <div className="space-y-2">
        {(verTodos ? confirmados : confirmados.slice(0, 8)).map((p) => (
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
      {confirmados.length > 8 && (
        <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-2 text-xs text-mute underline hover:text-ink">
          {verTodos ? 'Mostrar menos' : `Ver todos (${confirmados.length})`}
        </button>
      )}
        </div>

        <details className="panel" open={!cfg.chave.trim()}>
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-ink">
            Chave Pix e valor <span className="font-normal text-mute">({reais(Number(cfg.valor) || 0)})</span>
          </summary>
          <div className="px-4 pb-4">
      <form onSubmit={salvarCfg}>
        <fieldset disabled={!podeEditarPix} className="space-y-3">
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
        <div className="mt-4 border-t border-line pt-4">
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

          </div>
        </details>
      </div>
      {aberto && (
        <VerComprovante
          pagamento={aberto}
          duplicados={mesmoId(aberto)}
          aoFechar={() => setAberto(null)}
          data={datas[aberto.id] ?? hoje()}
          aoMudarData={(v) => setDatas({ ...datas, [aberto.id]: v })}
          confirmar={() => {
            confirmar(aberto)
            setAberto(null)
          }}
        />
      )}
    </div>
  )
}
