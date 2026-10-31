import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Navbar = () => {
  const { session, profile, signOut } = useAuth()

  return (
    <nav style={{ display: 'flex', gap: 15, padding: 15, background: '#f0f0f0', alignItems: 'center' }}>
      <Link to="/">Inicio</Link>
      {session ? (
        <>
          <Link to="/profile">Mi perfil ({profile?.role})</Link>
          {profile?.role === 'admin' && <Link to="/admin/products">Gestionar productos</Link>}
          {profile?.role === 'cliente' && <Link to="/shop">Tienda</Link>}
          {profile?.role === 'cliente' && <Link to="/orders">Mis órdenes</Link>}
          <button onClick={signOut} style={{ marginLeft: 'auto' }}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ marginLeft: 'auto' }}>Iniciar sesión</Link>
          <Link to="/register">Registrarse</Link>
        </>
      )}
    </nav>
  )
}

export default Navbar
