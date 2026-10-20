import { Navigate, Route, Routes } from 'react-router-dom'
import { LandlordLogin } from './pages/LandlordLogin'
import { TenantLogin } from './pages/TenantLogin'
import { Dashboard } from './pages/Dashboard'
import { Board } from './pages/Board'
import { Groups } from './pages/Groups'
import { TenantHome } from './pages/TenantHome'
import { Landing } from './pages/Landing'
import { Register } from './pages/Register'
import { Onboarding } from './pages/Onboarding'
import { Payments } from './pages/Payments'
import { Messages } from './pages/Messages'
import { ProtectedRoute } from './auth/ProtectedRoute'

const landlord = (el) => <ProtectedRoute roles={['LANDLORD', 'AGENT']}>{el}</ProtectedRoute>

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LandlordLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={landlord(<Onboarding />)} />
      <Route path="/payments" element={landlord(<Payments />)} />
      <Route path="/messages" element={landlord(<Messages />)} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
