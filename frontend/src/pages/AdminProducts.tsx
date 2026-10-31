import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Product } from '../types'

const AdminProducts = () => {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', description: '', price: '', image_url: '' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (!error && data) setProducts(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      const { error } = await supabase
        .from('products')
        .update({
          name: form.name,
          description: form.description || null,
          price: parseFloat(form.price),
          image_url: form.image_url || null,
        })
        .eq('id', editingId)
      if (!error) {
        setEditingId(null)
        setForm({ name: '', description: '', price: '', image_url: '' })
        fetchProducts()
      }
    } else {
      const { error } = await supabase.from('products').insert({
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        image_url: form.image_url || null,
        created_by: user?.id,
      })
      if (!error) {
        setForm({ name: '', description: '', price: '', image_url: '' })
        fetchProducts()
      }
    }
  }

  const handleEdit = (product: Product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      image_url: product.image_url || '',
    })
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar producto?') && user) {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (!error) fetchProducts()
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm({ name: '', description: '', price: '', image_url: '' })
  }

  if (loading) return <div style={{ padding: 20 }}>Cargando...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto', padding: 20 }}>
      <h2>Panel Admin - Productos</h2>
      <form onSubmit={handleSubmit} style={{ background: '#f5f5f5', padding: 20, borderRadius: 8, marginBottom: 30 }}>
        <h3>{editingId ? 'Editar producto' : 'Crear producto'}</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            placeholder="Nombre del producto"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="Descripción"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Precio"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <input
            placeholder="URL de imagen (opcional)"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit">{editingId ? 'Actualizar' : 'Crear'}</button>
            {editingId && <button type="button" onClick={cancelEdit}>Cancelar</button>}
          </div>
        </div>
      </form>

      <h3>Productos existentes</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: 10, textAlign: 'left' }}>Nombre</th>
            <th style={{ padding: 10, textAlign: 'left' }}>Precio</th>
            <th style={{ padding: 10, textAlign: 'left' }}>Descripción</th>
            <th style={{ padding: 10, textAlign: 'left' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 10 }}>{product.name}</td>
              <td style={{ padding: 10 }}>${product.price}</td>
              <td style={{ padding: 10 }}>{product.description}</td>
              <td style={{ padding: 10, display: 'flex', gap: 10 }}>
                <button onClick={() => handleEdit(product)}>Editar</button>
                <button onClick={() => handleDelete(product.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AdminProducts
