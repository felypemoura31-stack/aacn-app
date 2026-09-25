import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Navbar() {
  const { currentUser, player, logout } = useAuth()

  if (!currentUser) return null

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-sm text-sm font-medium ${
      isActive ? 'bg-accent text-white' : 'text-mute hover:bg-surface2'
    }`

  return (
    <nav className="no-print sticky top-0 z-10 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-4 py-2">
        <img src="/logo.png" alt="AACN" className="mr-2 h-8 w-8 rounded-full ring-1 ring-accent-hi/60" />
        <NavLink to="/" end className={linkClass}>
          Minha carteirinha
        </NavLink>
        <NavLink to="/perfil" className={linkClass}>
          Meus dados
        </NavLink>
        <NavLink to="/solicitacoes" className={linkClass}>
          Solicitações do time
        </NavLink>
        {player?.role === 'admin' && (
          <>
            <NavLink to="/admin" end className={linkClass}>
              Admin: Jogadores
            </NavLink>
            <NavLink to="/admin/times" className={linkClass}>
              Admin: Times
            </NavLink>
          </>
        )}
        <button
          onClick={() => logout()}
          className="ml-auto rounded-sm px-3 py-2 text-sm font-medium text-mute hover:bg-surface2"
        >
          Sair
        </button>
      </div>
    </nav>
  )
}
