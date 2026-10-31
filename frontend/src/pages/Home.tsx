import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

const Home = () => {
  const { session, profile, signOut } = useAuth()

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
      <h1>Tienda con Auth + Roles</h1>
      {session ? (
        <div>
          <p>Bienvenido, <strong>{profile?.full_name || session.user.email}</strong></p>
          <p>Rol: <strong>{profile?.role}</strong></p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Link to="/profile">Mi perfil</Link>
            {profile?.role === 'admin' && <Link to="/admin/products">Panel Admin</Link>}
            {profile?.role === 'cliente' && <Link to="/shop">Tienda</Link>}
            <button onClick={signOut}>Cerrar sesión</button>
          </div>
        </div>
      ) : (
        <div>
          <p>No has iniciado sesión</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/login">Iniciar sesión</Link>
            <Link to="/register">Registrarse</Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
