'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useOposicionPaths } from '@/hooks/useOposicionPaths'

export default function PremiumSuccess() {
  const { user, refreshUser } = useAuth() as unknown as { user: { id: string } | null; refreshUser?: () => Promise<void> }
  const { testUrl } = useOposicionPaths()
  const router = useRouter()
  const [synced, setSynced] = useState(false)
  const [navigating, setNavigating] = useState(false)

  // Forzar recarga del perfil UNA VEZ para que el cliente sepa que ya es premium
  useEffect(() => {
    if (user && refreshUser && !synced) {
      refreshUser().then(() => setSynced(true))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleStart = () => {
    setNavigating(true)
    router.push(testUrl)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-12">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">¡Bienvenido a Premium!</h1>
          <p className="text-lg text-gray-600 mb-6">
            Tu suscripción se ha configurado correctamente. Ya tienes acceso ilimitado.
          </p>
          <button
            onClick={handleStart}
            disabled={navigating}
            className="bg-blue-600 text-white py-4 px-6 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-70 transition-all"
          >
            {navigating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Cargando...
              </span>
            ) : (
              '🚀 Empezar a Estudiar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
