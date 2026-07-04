'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const PsychometricTestLayout = dynamic(() => import('@/components/PsychometricTestLayout'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando componente de test...</p>
      </div>
    </div>
  )
})

function PsychometricTestContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCategories, setSelectedCategories] = useState([])

  useEffect(() => {
    const categoriesParam = searchParams.get('categories')
    const sectionsParam = searchParams.get('sections')
    
    // Si no hay parámetros, redirigir a la página de configuración
    if (!categoriesParam && !sectionsParam) {
      console.log('🔄 No categories/sections specified, redirecting to configuration')
      router.push('/auxiliar-administrativo-estado/test')
      return
    }

    // Si hay parámetros, redirigir a la página correcta (plural)
    const currentUrl = new URLSearchParams(searchParams)
    router.push(`/auxiliar-administrativo-estado/test/psicotecnicos?${currentUrl.toString()}`)
  }, [searchParams, router])

  // Mostrar loading mientras se redirige
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo al test psicotécnico...</p>
      </div>
    </div>
  )
}

export default function PsychometricTestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <PsychometricTestContent />
    </Suspense>
  )
}