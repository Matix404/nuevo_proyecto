import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'

interface ProtectedRouteProps {
  allowedRoles?: Role[]
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { session, profile, loading } = useAuth()

  if (loading) return <div style={{ padding: 20 }}>Cargando...</div>
  if (!session) return <Navigate to="/login" replace />
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
