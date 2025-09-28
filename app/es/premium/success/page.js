'use client'
import Link from 'next/link'

export default function PremiumSuccess() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-12">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">¡Bienvenido a Premium!</h1>
          <p className="text-lg text-gray-600 mb-6">
            Tu suscripción se ha configurado correctamente. Tienes <strong>7 días de prueba gratuita</strong>.
          </p>
          <Link href="/es/auxiliar-administrativo-estado/test" 
                className="bg-blue-600 text-white py-4 px-6 rounded-lg font-bold hover:bg-blue-700">
            🚀 Empezar a Estudiar
          </Link>
        </div>
      </div>
    </div>
  )
}
