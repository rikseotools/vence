// app/administrativo/page.js
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdministrativoPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirigir inmediatamente a auxiliar-administrativo-estado
    router.replace('/auxiliar-administrativo-estado')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo a Auxiliar Administrativo...</p>
      </div>
    </div>
  )
}