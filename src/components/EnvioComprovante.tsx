import { useRef, useState } from 'react'
import { enviarComprovante, idTransacaoValido, limparIdTransacao, reduzirComprovante } from '../lib/comprovante'
import { paraMillis } from '../lib/status'
import type { Payment } from '../types'

/** O jogador envia o comprovante do Pix pago; a diretoria confere pelo código de identificação e confirma. */
export function EnvioComprovante({ pagamento, uid }: { pagamento: Payment; uid: string }) {
  const arquivo = useRef<HTMLInputElement>(null)
  const [id, setId] = useState(pagamento.idTransacao ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const enviadoEm = paraMillis(pagamento.comprovanteEm)

  async function enviar() {
    const f = arquivo.current?.files?.[0]
    if (!f) return setErro('Escolha o print ou a foto do comprovante.')
    const idLimpo = limparIdTransacao(id)
    if (!idTransacaoValido(idLimpo)) return setErro('O ID da transação tem 32 letras e números e começa com E (ex.: E1823...). Confira ou deixe em branco.')
    setErro(null)
    setEnviando(true)
    try {
      const imagem = await reduzirComprovante(f)
      await enviarComprovante(pagamento.id, uid, imagem, idLimpo)
      if (arquivo.current) arquivo.current.value = ''
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar agora. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  async function copiarCodigo() {
    await navigator.clipboard.writeText(pagamento.txid)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="border-t border-line pt-3">
      <p className="text-xs font-semibold text-ink">Já pagou? Envie o comprovante</p>
      <p className="mt-1 text-[11px] text-mute">
        Código de identificação deste Pix:{' '}
        <button type="button" onClick={copiarCodigo} className="font-mono text-ink underline" title="Copiar">
          {copiado ? 'copiado!' : pagamento.txid}
        </button>
      </p>

      {enviadoEm && (
        <p className="mt-2 rounded-sm border border-ok/40 bg-ok/10 px-2 py-1 text-[11px] text-ok">
          Comprovante enviado em {new Date(enviadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. A diretoria vai conferir e confirmar.
        </p>
      )}

      <input
        ref={arquivo}
        type="file"
        accept="image/*"
        className="mt-2 block w-full max-w-full text-xs text-mute file:mr-2 file:rounded-sm file:border-0 file:bg-surface2 file:px-2 file:py-1 file:text-xs file:text-ink"
      />
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="ID da transação (opcional, começa com E)"
        autoComplete="off"
        className="input mt-2 font-mono text-xs"
      />
      {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
      <button type="button" onClick={enviar} disabled={enviando} className="btn-ghost mt-2 w-full">
        {enviando ? 'Enviando...' : enviadoEm ? 'Enviar outro comprovante' : 'Enviar comprovante'}
      </button>
    </div>
  )
}
