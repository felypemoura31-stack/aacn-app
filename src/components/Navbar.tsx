import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePedidos } from '../contexts/PedidosContext'
import { rotuloDoCargo } from '../lib/roles'
import { useEhRepresentante } from '../lib/useRepresentante'
import type { UserRole } from '../types'

interface LinkItem {
  to: string
  rotulo: string
  end?: boolean
}

interface Grupo {
  titulo: string
  roles: UserRole[]
  itens: LinkItem[]
}

/** Links de quem é associado (todos veem). No celular ficam no menu; no computador, na barra de cima. */
const LINKS: LinkItem[] = [
  { to: '/', rotulo: 'Minha carteirinha', end: true },
  { to: '/perfil', rotulo: 'Meus dados' },
  { to: '/jogos', rotulo: 'Jogos' },
  { to: '/times', rotulo: 'Times' },
  { to: '/parceiros', rotulo: 'Parceiros' },
  { to: '/historico', rotulo: 'Histórico' },
  { to: '/validar', rotulo: 'Validar carteirinha' },
]

const GRUPOS: Grupo[] = [
  {
    titulo: 'Administração',
    roles: ['admin'],
    itens: [
      { to: '/admin', rotulo: 'Jogadores', end: true },
      { to: '/admin/times', rotulo: 'Times' },
      { to: '/admin/cargos', rotulo: 'Cargos' },
      { to: '/admin/parceiros', rotulo: 'Parceiros' },
    ],
  },
  {
    titulo: 'Tesouraria',
    roles: ['admin', 'tesoureiro'],
    itens: [
      { to: '/admin/painel', rotulo: 'Painel e relatórios' },
      { to: '/admin/pagamentos', rotulo: 'Pagamentos' },
      { to: '/admin/creditos', rotulo: 'Créditos' },
      { to: '/admin/cobrancas', rotulo: 'Cobranças' },
      { to: '/admin/carteirinhas', rotulo: 'Carteirinhas' },
    ],
  },
  {
    titulo: 'Jogos',
    roles: ['admin', 'tesoureiro', 'organizador'],
    itens: [
      { to: '/admin/checkin', rotulo: 'Check-in por QR' },
      { to: '/admin/jogos', rotulo: 'Gerenciar jogos' },
    ],
  },
  {
    titulo: 'Comunicação',
    roles: ['admin', 'tesoureiro', 'organizador'],
    itens: [{ to: '/admin/avisos', rotulo: 'Avisos' }],
  },
]

export function Navbar() {
  const { currentUser, player, logout, cadastroExcluido } = useAuth()
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  const ehRepresentante = useEhRepresentante(currentUser?.uid)
  const { pendentes } = usePedidos()
  const qtdPedidos = pendentes.length

  useEffect(() => setAberto(false), [pathname])

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto])

  if (!currentUser || cadastroExcluido) return null

  const grupos = GRUPOS.filter((g) => player && g.roles.includes(player.role))
  const links = ehRepresentante ? [...LINKS, { to: '/solicitacoes', rotulo: 'Solicitações do time' }] : LINKS
  // No computador o menu lateral só existe para quem tem cargo de gestão; no celular, para todos.
  const soCelular = grupos.length > 0 ? '' : 'md:hidden'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `shrink-0 px-2.5 py-2 rounded-sm text-sm font-medium ${
      isActive ? 'bg-accent text-white' : 'text-mute hover:bg-surface2'
    }`

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-sm px-3 py-2.5 text-sm font-medium ${
      isActive ? 'bg-accent text-white' : 'text-ink hover:bg-surface2'
    }`

  return (
    <>
      <nav className="no-print sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <button
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            aria-expanded={aberto}
            className={`flex shrink-0 items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-surface2 ${soCelular}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
            <span className="md:hidden">Menu</span>
            <span className="hidden md:inline">Gestão</span>
            {qtdPedidos > 0 && <span className="h-2 w-2 rounded-full bg-gold md:hidden" aria-label="Há pedidos de entrada no seu time" />}
          </button>
          <img src="/logo.png" alt="AACN" className="h-8 w-8 shrink-0 rounded-full ring-1 ring-accent-hi/60" />
          <span className="text-sm font-bold uppercase tracking-widest text-ink md:hidden">AACN</span>

          {/* computador: os links ficam na barra; se faltar espaço, a faixa rola de lado */}
          <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.rotulo}{l.to === '/solicitacoes' && qtdPedidos > 0 ? ` (${qtdPedidos})` : ''}
              </NavLink>
            ))}
          </div>
          <button
            onClick={() => logout()}
            className="ml-auto hidden shrink-0 rounded-sm px-3 py-2 text-sm font-medium text-mute hover:bg-surface2 md:block"
          >
            Sair
          </button>
        </div>
      </nav>

      <div className="no-print">
        <div
          onClick={() => setAberto(false)}
          className={`fixed inset-0 z-40 bg-black/60 transition-opacity ${soCelular} ${aberto ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        />
        <aside
          role="dialog"
          aria-label="Menu"
          aria-hidden={!aberto}
          className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface transition-transform duration-200 ${soCelular} ${aberto ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ borderTop: '2px solid var(--color-accent)' }}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold uppercase tracking-wider text-ink">
                <span className="md:hidden">{player?.nomeCompleto?.split(' ')[0] || 'Menu'}</span>
                <span className="hidden md:inline">Gestão</span>
              </p>
              <p className="text-xs text-gold">{player && rotuloDoCargo(player.role)}</p>
            </div>
            <button
              onClick={() => setAberto(false)}
              aria-label="Fechar menu"
              className="rounded-sm px-2 py-1 text-lg leading-none text-mute hover:bg-surface2 hover:text-ink"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {/* só no celular: os links de associado (no computador ficam na barra de cima) */}
            <div className="space-y-0.5 md:hidden">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} tabIndex={aberto ? 0 : -1} className={itemClass}>
                  {l.rotulo}{l.to === '/solicitacoes' && qtdPedidos > 0 ? ` (${qtdPedidos})` : ''}
                </NavLink>
              ))}
            </div>

            {grupos.map((g) => (
              <div key={g.titulo}>
                <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-widest text-mute/80">
                  <span className="md:hidden">Gestão · </span>
                  {g.titulo}
                </p>
                <div className="space-y-0.5">
                  {g.itens.map((i) => (
                    <NavLink key={i.to} to={i.to} end={i.end} tabIndex={aberto ? 0 : -1} className={itemClass}>
                      {i.rotulo}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-line p-3 md:hidden">
            <button onClick={() => logout()} className="btn-ghost w-full">
              Sair
            </button>
          </div>
        </aside>
      </div>
    </>
  )
}
