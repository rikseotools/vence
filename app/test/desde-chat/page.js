// app/test/desde-chat/page.js
// Test iniciado desde el chat de IA - usa el mismo sistema que tests normales
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '@/components/TestPageWrapper'

function TestDesdeChatContent() {
  const searchParams = useSearchParams()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      // Leer parámetros de la URL (igual que el sistema normal)
      const selectedLawsParam = searchParams.get('selected_laws')
      const numQuestions = parseInt(searchParams.get('n') || '10')

      if (!selectedLawsParam) {
        setError('No se especificaron leyes para el test')
        setLoading(false)
        return
      }

      const selectedLaws = JSON.parse(selectedLawsParam)

      if (!selectedLaws || selectedLaws.length === 0) {
        setError('No hay leyes seleccionadas')
        setLoading(false)
        return
      }

      // Configuración del test
      setConfig({
        selectedLaws,
        count: numQuestions,
        // Configuración por defecto para tests desde chat
        excludeRecent: false,
        difficultyMode: 'random',
        adaptiveMode: true
      })

      setLoading(false)
    } catch (e) {
      console.error('Error parsing test config:', e)
      setError('Error al cargar la configuración del test')
      setLoading(false)
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Preparando tu test...
          </h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            {error}
          </h2>
          <p className="text-gray-600 mb-6">
            Para crear un test desde el chat, primero pregunta sobre algún tema
            y usa la opción "¿Te preparo un test sobre esto?"
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  const lawsTitle = config.selectedLaws.length === 1
    ? config.selectedLaws[0]
    : `${config.selectedLaws.length} leyes`

  return (
    <TestPageWrapper
      tema={null}
      testType="personalizado"
      customTitle={`Test de ${lawsTitle}`}
      customDescription="Test generado desde el asistente de IA"
      customIcon="🤖"
      customColor="from-purple-500 to-indigo-600"
      customSubtitle={config.selectedLaws.join(' • ')}
      loadingMessage="🤖 Cargando preguntas..."
      defaultConfig={{
        selectedLaws: config.selectedLaws,
        count: config.count,
        numQuestions: config.count,
        excludeRecent: config.excludeRecent,
        difficultyMode: config.difficultyMode,
        adaptiveMode: config.adaptiveMode
      }}
    />
  )
}

export default function TestDesdeChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            🤖 Preparando test desde el chat...
          </h2>
        </div>
      </div>
    }>
      <TestDesdeChatContent />
    </Suspense>
  )
}
