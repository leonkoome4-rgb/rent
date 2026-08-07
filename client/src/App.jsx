import { Navigate, Route, Routes } from 'react-router-dom'
import { LandlordLogin } from './pages/LandlordLogin'
import { TenantLogin } from './pages/TenantLogin'
import { Dashboard } from './pages/Dashboard'
import { Board } from './pages/Board'
import { Groups } from './pages/Groups'
import { TenantHome } from './pages/TenantHome'
import { ProtectedRoute } from './auth/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LandlordLogin />} />
      <Route path="/tenant-login" element={<TenantLogin />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['LANDLORD', 'AGENT']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/board"
        element={
          <ProtectedRoute roles={['LANDLORD', 'AGENT']}>
            <Board />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups"
        element={
          <ProtectedRoute roles={['LANDLORD', 'AGENT']}>
            <Groups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute roles={['TENANT']}>
            <TenantHome />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
