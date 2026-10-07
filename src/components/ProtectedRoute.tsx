import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { faltasDoCadastro } from '../lib/cadastro'
import { temCargo } from '../lib/roles'
import type { UserRole } from '../types'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth()
  const local = useLocation()

  if (loading) return <CenteredMessage>Carregando...</CenteredMessage>
  // guarda o endereço pedido (ex.: link de um jogo) para voltar a ele depois do login
  if (!currentUser) return <Navigate to="/login" replace state={{ from: local.pathname + local.search }} />

  return <>{children}</>
}

/** Só deixa passar quem já preencheu os dados pessoais obrigatórios; senão manda para Meus dados. */
export function CadastroCompletoRoute({ children }: { children: ReactNode }) {
  const { currentUser, player, loading } = useAuth()
  const local = useLocation()
  const from = local.pathname + local.search

  if (loading) return <CenteredMessage>Carregando...</CenteredMessage>
  if (!currentUser) return <Navigate to="/login" replace state={{ from }} />
  if (player && faltasDoCadastro(player).length > 0) return <Navigate to="/perfil" replace state={{ from }} />

  return <>{children}</>
}

function RoleRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { currentUser, player, loading } = useAuth()

  if (loading) return <CenteredMessage>Carregando...</CenteredMessage>
  if (!currentUser) return <Navigate to="/login" replace />
  if (!player || !roles.some((r) => temCargo(player, r))) return <Navigate to="/" replace />

  return <>{children}</>
}

export function AdminRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={['admin']}>{children}</RoleRoute>
}

/** Pagamentos e créditos: admin e tesoureiro. */
export function FinanceiroRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={['admin', 'tesoureiro']}>{children}</RoleRoute>
}

/** Gestão de jogos: admin, tesoureiro e organizador. */
export function JogosRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={['admin', 'tesoureiro', 'organizador']}>{children}</RoleRoute>
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-mute">
      {children}
    </div>
  )
}
