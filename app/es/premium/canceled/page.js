'use client'
import Link from 'next/link'

export default function PremiumCanceled() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-6xl mb-6">😔</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Suscripción Cancelada</h1>
          <p className="text-lg text-gray-600 mb-6">
            No te preocupes, puedes intentarlo de nuevo cuando quieras.
          </p>
          <Link href="/es/premium" 
                className="bg-blue-600 text-white py-4 px-6 rounded-lg font-bold hover:bg-blue-700">
            Intentar de nuevo
          </Link>
        </div>
      </div>
    </div>
  )
}
