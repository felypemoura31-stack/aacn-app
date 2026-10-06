import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
import { Terms } from './pages/Terms'
import { AdminCobrancas } from './pages/admin/AdminCobrancas'
import { AdminCarteirinhas } from './pages/admin/AdminCarteirinhas'
import { AdminAvisos } from './pages/admin/AdminAvisos'
import { AdminPanel } from './pages/admin/AdminPanel'
import { AdminPartners } from './pages/admin/AdminPartners'
import { Partners } from './pages/Partners'
import { History } from './pages/History'
import { ForgotPassword } from './pages/ForgotPassword'
import { OfflineBanner } from './components/OfflineBanner'
import { TeamProfile } from './pages/TeamProfile'
import { Validar } from './pages/Validar'
import { ConquistasProvider } from './contexts/ConquistasContext'
import { CadastroExcluido } from './pages/CadastroExcluido'

/** Páginas que continuam abertas mesmo quando o cadastro de quem está logado foi excluído. */
const PUBLICAS = ['/validar', '/verificar/', '/termos']

function GuardaCadastro({ children }: { children: React.ReactNode }) {
  const { cadastroExcluido } = useAuth()
  const { pathname } = useLocation()
  if (cadastroExcluido && !PUBLICAS.some((p) => pathname.startsWith(p))) return <CadastroExcluido />
  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <ConquistasProvider>
      {import.meta.env.MODE === 'demo' && (
        <div className="no-print bg-gold/15 px-3 py-1 text-center text-xs text-gold">
          Modo demonstração (dados fictícios). Logins: admin@teste.com,
          tesoureiro@teste.com ou jogador@teste.com, senha 123456
        </div>
      )}
      <OfflineBanner />
      <Navbar />
      <GuardaCadastro>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/verificar/:uid" element={<Verify />} />
        <Route path="/validar" element={<Validar />} />

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
          path="/parceiros"
          element={
            <ProtectedRoute>
              <Partners />
            </ProtectedRoute>
          }
        />
        <Route
          path="/historico"
          element={
            <ProtectedRoute>
              <History />
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

        <Route
          path="/admin/carteirinhas"
          element={
            <FinanceiroRoute>
              <AdminCarteirinhas />
            </FinanceiroRoute>
          }
        />

        <Route
          path="/admin/carteirinhas/:uid"
          element={
            <FinanceiroRoute>
              <AdminCarteirinhas />
            </FinanceiroRoute>
          }
        />

        <Route
          path="/admin/cobrancas"
          element={
            <FinanceiroRoute>
              <AdminCobrancas />
            </FinanceiroRoute>
          }
        />
        <Route
          path="/admin/avisos"
          element={
            <JogosRoute>
              <AdminAvisos />
            </JogosRoute>
          }
        />

        <Route
          path="/admin/painel"
          element={
            <FinanceiroRoute>
              <AdminPanel />
            </FinanceiroRoute>
          }
        />
        <Route
          path="/admin/parceiros"
          element={
            <AdminRoute>
              <AdminPartners />
            </AdminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </GuardaCadastro>
      </ConquistasProvider>
    </AuthProvider>
  )
}

export default App
