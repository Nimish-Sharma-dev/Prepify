import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loading } from '../components/Loading'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="Checking session…" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
