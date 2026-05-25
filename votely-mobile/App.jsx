import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import LoginPage from './components/loginPage.jsx'
import RegisterPage from './components/registerPage.jsx'
import DashboardPage from './components/dashboardPage.jsx'
import ElectionDetailPage from './components/electionDetailPage.jsx'
import VotePage from './components/votePage.jsx'
import AdminDashboardPage from './components/adminDashboardPage.jsx'
import AdminCreateElectionPage from './components/adminCreateElectionPage.jsx'
import { getMe, getStoredToken, logout as apiLogout } from './lib/api.js'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await getMe()
      setUser(response?.data || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const value = useMemo(() => ({ user, loading, refreshUser, signOut }), [user, loading, refreshUser, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function SplashScreen() {
  return (
    <div className='min-h-screen votely-bg flex items-center justify-center'>
      <div className='glass-panel rounded-3xl p-10 text-center space-y-3'>
        <img src='/userlogo.png' alt='Votely' className='h-12 mx-auto' />
        <p className='text-sm text-slate-500'>Memuat sesi...</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SplashScreen />
  if (!user) return <Navigate to='/auth/login' replace state={{ from: location.pathname }} />
  return children
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SplashScreen />
  if (!user) return <Navigate to='/auth/login' replace state={{ from: location.pathname }} />
  if (user?.role !== 'ADMIN') return <Navigate to='/dashboard' replace />
  return children
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <SplashScreen />
  return <Navigate to={user ? '/dashboard' : '/auth/login'} replace />
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path='/' element={<RootRedirect />} />
        <Route path='/auth/login' element={<LoginPage />} />
        <Route path='/auth/register' element={<RegisterPage />} />
        <Route
          path='/dashboard'
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path='/elections/:electionId'
          element={
            <RequireAuth>
              <ElectionDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path='/elections/:electionId/vote'
          element={
            <RequireAuth>
              <VotePage />
            </RequireAuth>
          }
        />
        <Route
          path='/admin'
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path='/admin/elections/new'
          element={
            <RequireAdmin>
              <AdminCreateElectionPage />
            </RequireAdmin>
          }
        />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
