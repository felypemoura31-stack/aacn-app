import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Navbar } from './components/Navbar'
import { ProtectedRoute, AdminRoute, FinanceiroRoute, JogosRoute, CadastroCompletoRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Profile } from './pages/Profile'
import { Card } from './pages/Card'
import { Verify } from './pages/Verify'
import { RepresentativeRequests } from './pages/RepresentativeRequests'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminPlayerDetail } from './pages/admin/AdminPlayerDetail'
import { AdminTeams } from './pages/admin/AdminTeams'
import { AdminPayments } from './pages/admin/AdminPayments'
import { AdminGames } from './pages/admin/AdminGames'
import { Games } from './pages/Games'
import { AdminCredits } from './pages/admin/AdminCredits'
import { AdminRoles } from './pages/admin/AdminRoles'
import { AdminCheckin } from './pages/admin/AdminCheckin'
import { Teams } from './pages/Teams'
import { TeamProfile } from './pages/TeamProfile'

function App() {
  return (
    <AuthProvider>
      {import.meta.env.MODE === 'demo' && (
        <div className="no-print bg-gold/15 px-3 py-1 text-center text-xs text-gold">
          Modo demonstração (dados fictícios). Logins: admin@teste.com,
          tesoureiro@teste.com ou jogador@teste.com, senha 123456
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
            <CadastroCompletoRoute>
              <Card />
            </CadastroCompletoRoute>
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
          path="/jogos"
          element={
            <CadastroCompletoRoute>
              <Games />
            </CadastroCompletoRoute>
          }
        />
        <Route
          path="/times"
          element={
            <ProtectedRoute>
              <Teams />
            </ProtectedRoute>
          }
        />
        <Route
          path="/times/:id"
          element={
            <ProtectedRoute>
              <TeamProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/solicitacoes"
          element={
            <CadastroCompletoRoute>
              <RepresentativeRequests />
            </CadastroCompletoRoute>
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

        <Route
          path="/admin/pagamentos"
          element={
            <FinanceiroRoute>
              <AdminPayments />
            </FinanceiroRoute>
          }
        />

        <Route
          path="/admin/jogos"
          element={
            <JogosRoute>
              <AdminGames />
            </JogosRoute>
          }
        />

        <Route
          path="/admin/creditos"
          element={
            <FinanceiroRoute>
              <AdminCredits />
            </FinanceiroRoute>
          }
        />

        <Route
          path="/admin/cargos"
          element={
            <AdminRoute>
              <AdminRoles />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/checkin"
          element={
            <JogosRoute>
              <AdminCheckin />
            </JogosRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
