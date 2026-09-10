import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth()

  if (loading) return <CenteredMessage>Carregando...</CenteredMessage>
  if (!currentUser) return <Navigate to="/login" replace />

  return <>{children}</>
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { currentUser, player, loading } = useAuth()

  if (loading) return <CenteredMessage>Carregando...</CenteredMessage>
  if (!currentUser) return <Navigate to="/login" replace />
  if (player?.role !== 'admin') return <Navigate to="/" replace />

  return <>{children}</>
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      {children}
    </div>
  )
}
