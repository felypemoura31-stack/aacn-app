import { lazy, Suspense } from 'react'
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
import { Games } from './pages/Games'
import { Teams } from './pages/Teams'
import { Terms } from './pages/Terms'
import { Partners } from './pages/Partners'
import { History } from './pages/History'
import { Ranking } from './pages/Ranking'
import { ForgotPassword } from './pages/ForgotPassword'
import { OfflineBanner } from './components/OfflineBanner'
import { TeamProfile } from './pages/TeamProfile'
import { Validar } from './pages/Validar'
import { ConquistasProvider } from './contexts/ConquistasContext'
import { PedidosProvider } from './contexts/PedidosContext'
import { AvisosProvider } from './contexts/AvisosContext'
import { AvisosNaoLidos } from './components/AvisosNaoLidos'
import { AvisoAniversario } from './components/AvisoAniversario'
import { AvisoPedidos } from './components/AvisoPedidos'
import { CadastroExcluido } from './pages/CadastroExcluido'

// telas de admin carregam sob demanda: um associado comum não baixa o código do caixa, do sorteio...
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const AdminPlayerDetail = lazy(() => import('./pages/admin/AdminPlayerDetail').then((m) => ({ default: m.AdminPlayerDetail })))
const AdminTeams = lazy(() => import('./pages/admin/AdminTeams').then((m) => ({ default: m.AdminTeams })))
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments').then((m) => ({ default: m.AdminPayments })))
const AdminGames = lazy(() => import('./pages/admin/AdminGames').then((m) => ({ default: m.AdminGames })))
const AdminCredits = lazy(() => import('./pages/admin/AdminCredits').then((m) => ({ default: m.AdminCredits })))
const AdminRoles = lazy(() => import('./pages/admin/AdminRoles').then((m) => ({ default: m.AdminRoles })))
const AdminCheckin = lazy(() => import('./pages/admin/AdminCheckin').then((m) => ({ default: m.AdminCheckin })))
const AdminCobrancas = lazy(() => import('./pages/admin/AdminCobrancas').then((m) => ({ default: m.AdminCobrancas })))
const AdminCarteirinhas = lazy(() => import('./pages/admin/AdminCarteirinhas').then((m) => ({ default: m.AdminCarteirinhas })))
const AdminAvisos = lazy(() => import('./pages/admin/AdminAvisos').then((m) => ({ default: m.AdminAvisos })))
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel').then((m) => ({ default: m.AdminPanel })))
const AdminPartners = lazy(() => import('./pages/admin/AdminPartners').then((m) => ({ default: m.AdminPartners })))
const AdminCaixa = lazy(() => import('./pages/admin/AdminCaixa').then((m) => ({ default: m.AdminCaixa })))
const AdminAuditoria = lazy(() => import('./pages/admin/AdminAuditoria').then((m) => ({ default: m.AdminAuditoria })))
const AdminSorteio = lazy(() => import('./pages/admin/AdminSorteio').then((m) => ({ default: m.AdminSorteio })))
const AdminPesos = lazy(() => import('./pages/admin/AdminPesos').then((m) => ({ default: m.AdminPesos })))

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
      <PedidosProvider>
      <AvisosProvider>
      {import.meta.env.MODE === 'demo' && (
        <div className="no-print bg-gold/15 px-3 py-1 text-center text-xs text-gold">
          Modo demonstração (dados fictícios). Logins: admin@teste.com,
          tesoureiro@teste.com ou jogador@teste.com, senha 123456
        </div>
      )}
      <OfflineBanner />
      <Navbar />
      <AvisoAniversario />
      <AvisosNaoLidos />
      <AvisoPedidos />
      <GuardaCadastro>
      <Suspense fallback={<p className="px-4 py-8 text-center text-sm text-mute">Carregando...</p>}>
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
          path="/ranking"
          element={
            <ProtectedRoute>
              <Ranking />
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
          path="/admin/sorteio"
          element={
            <JogosRoute>
              <AdminSorteio />
            </JogosRoute>
          }
        />
        <Route
          path="/admin/pesos"
          element={
            <AdminRoute>
              <AdminPesos />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/caixa"
          element={
            <FinanceiroRoute>
              <AdminCaixa />
            </FinanceiroRoute>
          }
        />
        <Route
          path="/admin/auditoria"
          element={
            <AdminRoute>
              <AdminAuditoria />
            </AdminRoute>
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
      </Suspense>
      </GuardaCadastro>
      </AvisosProvider>
      </PedidosProvider>
      </ConquistasProvider>
    </AuthProvider>
  )
}

export default App
