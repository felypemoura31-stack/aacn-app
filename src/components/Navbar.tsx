import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rotuloDoCargo } from '../lib/roles'
import { useEhRepresentante } from '../lib/useRepresentante'
import type { UserRole } from '../types'

interface Grupo {
  titulo: string
  roles: UserRole[]
  itens: { to: string; rotulo: string; end?: boolean }[]
}

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
  const { currentUser, player, logout } = useAuth()
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  const ehRepresentante = useEhRepresentante(currentUser?.uid)

  useEffect(() => setAberto(false), [pathname])

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto])

  if (!currentUser) return null

  const grupos = GRUPOS.filter((g) => player && g.roles.includes(player.role))

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-sm text-sm font-medium ${
      isActive ? 'bg-accent text-white' : 'text-mute hover:bg-surface2'
    }`

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-sm px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-accent text-white' : 'text-ink hover:bg-surface2'
    }`

  return (
    <>
      <nav className="no-print sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-4 py-2">
          {grupos.length > 0 && (
            <button
              onClick={() => setAberto(true)}
              aria-label="Abrir menu de gestão"
              aria-expanded={aberto}
              className="mr-1 flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-surface2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" />
              </svg>
              Gestão
            </button>
          )}
          <img src="/logo.png" alt="AACN" className="mr-2 h-8 w-8 rounded-full ring-1 ring-accent-hi/60" />
          <NavLink to="/" end className={linkClass}>
            Minha carteirinha
          </NavLink>
          <NavLink to="/perfil" className={linkClass}>
            Meus dados
          </NavLink>
          <NavLink to="/jogos" className={linkClass}>
            Jogos
          </NavLink>
          <NavLink to="/times" className={linkClass}>
            Times
          </NavLink>
          <NavLink to="/parceiros" className={linkClass}>
            Parceiros
          </NavLink>
          <NavLink to="/historico" className={linkClass}>
            Histórico
          </NavLink>
          {ehRepresentante && (
            <NavLink to="/solicitacoes" className={linkClass}>
              Solicitações do time
            </NavLink>
          )}
          <button
            onClick={() => logout()}
            className="ml-auto rounded-sm px-3 py-2 text-sm font-medium text-mute hover:bg-surface2"
          >
            Sair
          </button>
        </div>
      </nav>

      {grupos.length > 0 && (
        <div className="no-print">
          <div
            onClick={() => setAberto(false)}
            className={`fixed inset-0 z-40 bg-black/60 transition-opacity ${aberto ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          />
          <aside
            role="dialog"
            aria-label="Menu de gestão"
            aria-hidden={!aberto}
            className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface transition-transform duration-200 ${aberto ? 'translate-x-0' : '-translate-x-full'}`}
            style={{ borderTop: '2px solid var(--color-accent)' }}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-ink">Gestão</p>
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
              {grupos.map((g) => (
                <div key={g.titulo}>
                  <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-widest text-mute/80">{g.titulo}</p>
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
          </aside>
        </div>
      )}
    </>
  )
}
