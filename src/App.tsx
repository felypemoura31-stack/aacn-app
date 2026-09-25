import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Navbar } from './components/Navbar'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Profile } from './pages/Profile'
import { Card } from './pages/Card'
import { Verify } from './pages/Verify'
import { RepresentativeRequests } from './pages/RepresentativeRequests'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminPlayerDetail } from './pages/admin/AdminPlayerDetail'
import { AdminTeams } from './pages/admin/AdminTeams'

function App() {
  return (
    <AuthProvider>
      {import.meta.env.MODE === 'demo' && (
        <div className="no-print bg-gold/15 px-3 py-1 text-center text-xs text-gold">
          Modo demonstração (dados fictícios). Logins: admin@teste.com ou
          jogador@teste.com, senha 123456
        </div>
      )}
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/verificar/:uid" element={<Verify />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Card />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/solicitacoes"
          element={
            <ProtectedRoute>
              <RepresentativeRequests />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/jogadores/:uid"
          element={
            <AdminRoute>
              <AdminPlayerDetail />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/times"
          element={
            <AdminRoute>
              <AdminTeams />
            </AdminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
