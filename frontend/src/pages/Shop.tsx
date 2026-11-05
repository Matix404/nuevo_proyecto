import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { Product } from '../types'

const ALL_CATEGORIES = 'all'

const Shop = () => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [category, setCategory] = useState(ALL_CATEGORIES)

  const categories = Array.from(
    new Set(
      products
        .map((product) => product.category)
        .filter((value): value is string => Boolean(value))
    )
  )

  const visibleProducts =
    category === ALL_CATEGORIES
      ? products
      : products.filter((product) => product.category === category)

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (!error && data) setProducts(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const addToCart = (productId: string) => {
    setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[productId] > 1) {
        newCart[productId]--
      } else {
        delete newCart[productId]
      }
      return newCart
    })
  }

  const getTotal = () => {
    return products.reduce((total, product) => {
      return total + product.price * (cart[product.id] || 0)
    }, 0)
  }

  const handlePurchase = async () => {
    if (Object.keys(cart).length === 0) {
      showToast('Carrito vacío', 'error')
      return
    }
    if (!user) {
      showToast('Usuario no autenticado', 'error')
      return
    }
    const total = getTotal()
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ user_id: user?.id, total, status: 'pending' })
      .select()
      .single()

    if (orderError || !order) {
      showToast('Error al crear orden', 'error')
      return
    }

    const orderItems = Object.entries(cart).map(([productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      return {
        order_id: order.id,
        product_id: productId,
        quantity,
        price: product?.price || 0
      }
    })

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

    if (itemsError) {
      showToast('Error al agregar items', 'error')
      return
    }

    showToast('Compra realizada con éxito!')
    setCart({})
  }

  if (loading) return <div style={{ padding: 20 }}>Cargando...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto', padding: 20 }}>
      <h2>Tienda</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 30 }}>
        <div>
          <h3>Productos</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
            <label htmlFor="category-filter">Categoría:</label>
            <select
              id="category-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ padding: 6 }}
            >
              <option value={ALL_CATEGORIES}>Todas</option>
              {categories.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <span style={{ color: '#666' }}>
              {visibleProducts.length} producto{visibleProducts.length === 1 ? '' : 's'}
            </span>
          </div>
          {visibleProducts.length === 0 && <p>No hay productos en esta categoría.</p>}
          <div style={{ display: 'grid', gap: 15 }}>
            {visibleProducts.map((product) => (
              <div key={product.id} style={{ border: '1px solid #ddd', padding: 15, borderRadius: 8 }}>
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, marginBottom: 10, display: 'block' }}
                  />
                )}
                <h4>{product.name}</h4>
                {product.category && <small style={{ color: '#666' }}>{product.category}</small>}
                <p>{product.description}</p>
                <p><strong>${product.price}</strong></p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button onClick={() => addToCart(product.id)}>Agregar al carrito</button>
                  <Link
                    to={`/product/${product.id}`}
                    style={{ padding: '2px 8px', border: '1px solid #767676', borderRadius: 2, background: '#efefef', color: 'inherit', textDecoration: 'none', fontSize: 13 }}
                  >
                    Ver reseñas
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Carrito</h3>
          <div style={{ background: '#f5f5f5', padding: 15, borderRadius: 8 }}>
            {Object.keys(cart).length === 0 ? (
              <p>Carrito vacío</p>
            ) : (
              <>
                {Object.entries(cart).map(([productId, quantity]) => {
                  const product = products.find(p => p.id === productId)
                  return (
                    <div key={productId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span>{product?.name} x{quantity}</span>
                      <div>
                        <button onClick={() => addToCart(productId)}>+</button>
                        <button onClick={() => removeFromCart(productId)}>-</button>
                      </div>
                    </div>
                  )
                })}
                <hr />
                <p><strong>Total: ${getTotal().toFixed(2)}</strong></p>
                <button onClick={handlePurchase} style={{ width: '100%', padding: 10 }}>Comprar</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Shop
