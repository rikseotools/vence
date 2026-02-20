'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function PremiumSuccess() {
  const { user, refreshUser } = useAuth()
  const [synced, setSynced] = useState(false)

  // Forzar recarga del perfil para que el cliente sepa que ya es premium
  useEffect(() => {
    if (user && refreshUser) {
      refreshUser().then(() => setSynced(true))
    }
  }, [user, refreshUser])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-12">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">¡Bienvenido a Premium!</h1>
          <p className="text-lg text-gray-600 mb-6">
            Tu suscripción se ha configurado correctamente. Ya tienes acceso ilimitado.
          </p>
          <Link href="/auxiliar-administrativo-estado/test"
                className="bg-blue-600 text-white py-4 px-6 rounded-lg font-bold hover:bg-blue-700">
            🚀 Empezar a Estudiar
          </Link>
        </div>
      </div>
    </div>
  )
}
