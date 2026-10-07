import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePedidos } from '../contexts/PedidosContext'

/**
 * Faixa para o representante: há pedidos de entrada esperando. Aparece em qualquer tela (menos na
 * própria lista de pedidos) e oferece ligar as notificações do aparelho.
 */
export function AvisoPedidos() {
  const { pendentes } = usePedidos()
  const { pathname } = useLocation()
  const [permissao, setPermissao] = useState<NotificationPermission | 'indisponivel'>(
    typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission,
  )

  if (pendentes.length === 0 || pathname.startsWith('/solicitacoes')) return null

  const nomes = pendentes.slice(0, 2).map((p) => p.jogadorNome.split(' ')[0])
  const resumo =
    pendentes.length === 1
      ? `${pendentes[0].jogadorNome} quer entrar no ${pendentes[0].timeNome}`
      : `${pendentes.length} pedidos para entrar no seu time (${nomes.join(', ')}${pendentes.length > 2 ? '…' : ''})`

  async function ativar() {
    try {
      setPermissao(await Notification.requestPermission())
    } catch {
      setPermissao('denied')
    }
  }

  return (
    <div className="no-print border-b border-gold/40 bg-gold/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-gold">
          <span aria-hidden="true">🔔 </span>
          {resumo}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {permissao === 'default' && (
            <button onClick={ativar} className="text-xs text-mute underline hover:text-ink">
              Avisar neste aparelho
            </button>
          )}
          <Link to="/solicitacoes" className="rounded-sm bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-bg hover:opacity-90">
            Ver pedidos
          </Link>
        </div>
      </div>
    </div>
  )
}
