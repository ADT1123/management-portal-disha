import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/dashboard.tsx';
import { Tasks } from './pages/Tasks';
import { Team } from './pages/Team';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { Setup } from './pages/Setup';
import { Meetings } from './pages/Meetings';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { ChatLayout } from './components/chat/ChatLayout.tsx'; // ✅ NEW - Chat System

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/setup"
              element={
                <Layout>
                  <Setup />
                </Layout>
              }
            />

            <Route path="/login" element={<Login />} />
            
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'member']}>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/tasks"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'member']}>
                  <Layout>
                    <Tasks />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/team"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                  <Layout>
                    <Team />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ✅ Clients Routes */}
            <Route
              path="/clients"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'member']}>
                  <Layout>
                    <Clients />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/clients/:clientId"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'member']}>
                  <Layout>
                    <ClientDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/meetings"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'member']}>
                  <Layout>
                    <Meetings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'member']}>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          {/* ✅ NEW - Floating Chat Button (Available on all authenticated pages) */}
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'member']}>
            <ChatLayout />
          </ProtectedRoute>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
