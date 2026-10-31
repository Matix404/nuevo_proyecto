import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

const Profile = () => {
  const { profile, user, signOut } = useAuth()

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 20 }}>
      <h2>Mi perfil</h2>
      <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 8 }}>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Nombre:</strong> {profile?.full_name || 'Sin nombre'}</p>
        <p><strong>Rol:</strong> {profile?.role}</p>
        <p><strong>ID:</strong> {profile?.id}</p>
      </div>
      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <Link to="/">Ir al inicio</Link>
        <button onClick={signOut}>Cerrar sesión</button>
      </div>
    </div>
  )
}

export default Profile
