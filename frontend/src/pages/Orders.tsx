import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Order, OrderItem } from '../types'

const Orders = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setOrders(data)
    setLoading(false)
  }

  const fetchOrderItems = async (orderId: string) => {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
    if (!error && data) {
      setOrderItems(prev => ({ ...prev, [orderId]: data }))
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [user])

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto', padding: 20 }}>
      <h2>Mis órdenes</h2>
      {loading ? (
        <div style={{ padding: 20 }}>Cargando...</div>
      ) : orders.length === 0 ? (
        <p>No tienes órdenes aún.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Fecha</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Total</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Estado</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Items</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 10 }}>
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: 10 }}>${order.total.toFixed(2)}</td>
                <td style={{ padding: 10 }}>{order.status}</td>
                <td style={{ padding: 10 }}>
                  {orderItems[order.id]?.length > 0 ? (
                    orderItems[order.id].map((item) => (
                      <div key={item.id} style={{ marginBottom: 4 }}>
                        x{item.quantity} - ${item.price.toFixed(2)}
                      </div>
                    ))
                  ) : (
                    <button
                      onClick={() => fetchOrderItems(order.id)}
                      style={{ padding: '4px 8px', fontSize: 12 }}
                    >
                      Ver detalles
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 20 }}>
        <Link to="/shop">Seguir comprando</Link>
      </div>
    </div>
  )
}

export default Orders
