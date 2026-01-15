// app/test/repaso-fallos-v2/page.tsx
// Test de repaso de preguntas falladas - Versión 2 con Drizzle + Zod + TestLayoutV2
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TestLayoutV2 from '@/components/v2/TestLayoutV2'
import type { TestLayoutQuestion, TestConfig } from '@/lib/api/tests'

interface CreateTestResponse {
  success: boolean
  questions?: TestLayoutQuestion[]
  questionCount?: number
  message?: string
  error?: string
  testType?: string
}

function RepasoFallosV2Content() {
  const searchParams = useSearchParams()
  const { user, loading: authLoading, supabase } = useAuth() as {
    user: { id: string } | null
    loading: boolean
    supabase: { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } }
  }
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<TestLayoutQuestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFailedQuestions() {
      if (authLoading) return

      if (!user) {
        setError('Debes iniciar sesión para ver tus preguntas falladas')
        setLoading(false)
        return
      }

      try {
        // Obtener token de sesión
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setError('Debes iniciar sesión para ver tus preguntas falladas')
          setLoading(false)
          return
        }

        const numQuestions = searchParams.get('n') || '10'
        const orderBy = searchParams.get('order') || 'recent'
        const days = searchParams.get('days') || '30'
        const fromDate = searchParams.get('fromDate')

        // Construir body del request
        const requestBody: {
          numQuestions: number
          orderBy: string
          days?: number
          fromDate?: string
        } = {
          numQuestions: parseInt(numQuestions),
          orderBy,
        }

        if (fromDate) {
          requestBody.fromDate = fromDate
        } else {
          requestBody.days = parseInt(days)
        }

        // Llamar a la API v2 (Drizzle + Zod)
        const response = await fetch('/api/v2/tests/failed-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
        })

        const data: CreateTestResponse = await response.json()

        if (!response.ok || !data.success) {
          if (data.message?.includes('Enhorabuena') || data.message?.includes('No tienes')) {
            setError(data.message)
          } else {
            setError(data.error || data.message || 'Error al cargar las preguntas')
          }
          setLoading(false)
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setError(data.message || 'No tienes preguntas falladas')
          setLoading(false)
          return
        }

        // Preguntas cargadas correctamente
        setQuestions(data.questions)
        setLoading(false)

      } catch (e) {
        console.error('Error loading failed questions:', e)
        setError('Error al cargar las preguntas falladas')
        setLoading(false)
      }
    }

    loadFailedQuestions()
  }, [user, authLoading, supabase, searchParams])

  // Estado de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Analizando tus puntos débiles...
          </h2>
          <p className="text-gray-600">
            Buscando preguntas donde necesitas más práctica
          </p>
          <p className="text-xs text-gray-400 mt-4">
            API v2 (Drizzle + Zod)
          </p>
        </div>
      </div>
    )
  }

  // Estado de error
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">
            {error.includes('Enhorabuena') ? '🎉' : error.includes('sesión') ? '🔐' : '📊'}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            {error.includes('Enhorabuena') ? '¡Excelente trabajo!' :
             error.includes('sesión') ? 'Inicia sesión' : 'Sin datos suficientes'}
          </h2>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <div className="flex gap-3 justify-center">
            {error.includes('sesión') ? (
              <a
                href="/login"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Iniciar sesión
              </a>
            ) : (
              <a
                href="/"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Volver al inicio
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Config del test
  const config: TestConfig = {
    name: "Test de Repaso de Fallos",
    description: `Practicando ${questions.length} preguntas que necesitas reforzar`,
    subtitle: "Repasa tus puntos débiles",
    icon: "🎯",
    color: "from-red-500 to-orange-600",
  }

  // Test cargado - renderizar TestLayoutV2
  return (
    <TestLayoutV2
      tema={0}
      testNumber="repaso_fallos_v2"
      config={config}
      questions={questions}
    />
  )
}

export default function RepasoFallosV2Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Preparando test de repaso...
          </h2>
          <p className="text-xs text-gray-400 mt-4">
            API v2 (Drizzle + Zod)
          </p>
        </div>
      </div>
    }>
      <RepasoFallosV2Content />
    </Suspense>
  )
}
