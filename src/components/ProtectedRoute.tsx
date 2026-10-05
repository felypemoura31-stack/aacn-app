import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { UserRole } from '../types'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth()

  if (loading) return <CenteredMessage>Carregando...</CenteredMessage>
  if (!currentUser) return <Navigate to="/login" replace />

  return <>{children}</>
}

function RoleRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { currentUser, player, loading } = useAuth()

  if (loading) return <CenteredMessage>Carregando...</CenteredMessage>
  if (!currentUser) return <Navigate to="/login" replace />
  if (!player || !roles.includes(player.role)) return <Navigate to="/" replace />

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
