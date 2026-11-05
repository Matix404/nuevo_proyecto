import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { Product, Review } from '../types'

const ProductDetail = () => {
  const { id } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [product, setProduct] = useState<Product | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const { data: productData } = await supabase.from('products').select('*').eq('id', id).single()
    const { data: reviewsData } = await supabase.from('reviews').select('*').eq('product_id', id).order('created_at', { ascending: false })
    setProduct(productData)
    setReviews(reviewsData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [id])

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('reviews').insert({
      product_id: id,
      user_id: user?.id,
      rating,
      comment: comment || null
    })
    if (!error) {
      setComment('')
      fetchData()
      showToast('Reseña enviada')
    } else {
      showToast('Error al dejar reseña. Puede que ya hayas dejado una para este producto.', 'error')
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Cargando...</div>
  if (!product) return <div style={{ padding: 20 }}>Producto no encontrado</div>

  return (
    <div style={{ maxWidth: 800, margin: '20px auto', padding: 20 }}>
      <h2>{product.name}</h2>
      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.name}
          style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8, marginBottom: 15, display: 'block' }}
        />
      )}
      {product.category && <p><small>Categoría: {product.category}</small></p>}
      <p>{product.description}</p>
      <p><strong>${product.price}</strong></p>

      <hr style={{ margin: '30px 0' }} />

      <h3>Reseñas</h3>
      {user && (
        <form onSubmit={handleReview} style={{ background: '#f5f5f5', padding: 15, borderRadius: 8, marginBottom: 20 }}>
          <h4>Dejar reseña</h4>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ marginBottom: 10 }}>
            <option value={5}>5 estrellas</option>
            <option value={4}>4 estrellas</option>
            <option value={3}>3 estrellas</option>
            <option value={2}>2 estrellas</option>
            <option value={1}>1 estrella</option>
          </select>
          <textarea
            placeholder="Comentario (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 10 }}
          />
          <button type="submit">Enviar reseña</button>
        </form>
      )}

      {reviews.length === 0 ? (
        <p>No hay reseñas aún</p>
      ) : (
        reviews.map((review) => (
          <div key={review.id} style={{ border: '1px solid #ddd', padding: 10, marginBottom: 10, borderRadius: 8 }}>
            <p><strong>{'⭐'.repeat(review.rating)}</strong></p>
            {review.comment && <p>{review.comment}</p>}
            <small>{new Date(review.created_at).toLocaleDateString()}</small>
          </div>
        ))
      )}
    </div>
  )
}

export default ProductDetail
