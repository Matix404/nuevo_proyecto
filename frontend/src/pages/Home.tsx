import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

const Home = () => {
  const { session, profile, signOut } = useAuth()

  if (!session) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20, textAlign: 'center' }}>
        <h1>Bienvenido</h1>
        <p>No has iniciado sesión</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
          <Link to="/login">Iniciar sesión</Link>
          <Link to="/register">Registrarse</Link>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin'
  const isCliente = profile?.role === 'cliente'

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
      <h1>Panel de control</h1>
      <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 8, marginBottom: 30 }}>
        <p><strong>Usuario:</strong> {profile?.full_name || session.user.email}</p>
        <p><strong>Rol:</strong> {profile?.role || 'sin rol'}</p>
        <p><strong>Email:</strong> {session.user.email}</p>
      </div>

      {!profile && (
        <p style={{ color: '#b45309', marginBottom: 20 }}>
          No existe tu registro en <code>profiles</code>: sin rol no vas a poder acceder a las pantallas de admin ni de cliente.
        </p>
      )}

      <h2>Acciones disponibles</h2>
      <div style={{ display: 'grid', gap: 15, maxWidth: 500 }}>
        <Link to="/profile" style={{ padding: 15, background: '#e0e0e0', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
          Mi perfil
        </Link>
        {isAdmin && (
          <Link to="/admin/products" style={{ padding: 15, background: '#e0e0e0', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
            Gestionar productos (Admin)
          </Link>
        )}
        {isCliente && (
          <>
            <Link to="/shop" style={{ padding: 15, background: '#e0e0e0', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
              Ir a la tienda
            </Link>
            <Link to="/orders" style={{ padding: 15, background: '#e0e0e0', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
              Mis órdenes
            </Link>
          </>
        )}
      </div>

      <div style={{ marginTop: 30 }}>
        <button onClick={signOut} style={{ padding: 10, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default Home
