'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import GoogleOneTap from './GoogleOneTap'

export default function GoogleOneTapWrapper() {
  const { user, loading } = useAuth()
  const [showOneTap, setShowOneTap] = useState(false)

  useEffect(() => {
    // Solo mostrar One Tap si:
    // 1. No hay usuario logueado
    // 2. Ya terminó de cargar
    // 3. Estamos en el cliente
    if (!loading && !user && typeof window !== 'undefined') {
      // Pequeño delay para no interferir con la carga inicial
      const timer = setTimeout(() => {
        setShowOneTap(true)
      }, 2000)

      return () => clearTimeout(timer)
    } else {
      setShowOneTap(false)
    }
  }, [user, loading])

  const handleSuccess = (data) => {
    console.log('✅ Google One Tap login exitoso:', data.user?.email)
    setShowOneTap(false)
    // El AuthContext se actualizará automáticamente via el evento
  }

  const handleError = (error) => {
    console.error('❌ Google One Tap error:', error)
    // No ocultamos One Tap en error para que el usuario pueda reintentar
  }

  if (!showOneTap) return null

  return (
    <GoogleOneTap
      onSuccess={handleSuccess}
      onError={handleError}
      disabled={!!user || loading}
    />
  )
}
