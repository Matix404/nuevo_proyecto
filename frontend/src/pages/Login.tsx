import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error, profile: signedProfile } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (!signedProfile) {
      setError('Tu usuario no tiene perfil asignado. Pedile al administrador que te asigne un rol.')
      return
    }
    navigate(signedProfile.role === 'admin' ? '/admin/products' : '/shop', { replace: true })
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 20 }}>
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p style={{ marginTop: 12 }}>
        ¿No tienes cuenta? <Link to="/register">Registrarse</Link>
      </p>
    </div>
  )
}

export default Login
