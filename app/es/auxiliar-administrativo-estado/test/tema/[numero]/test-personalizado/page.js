// app/es/auxiliar-administrativo-estado/test/tema/[numero]/test-personalizado/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '../../../../../../../components/TestPageWrapper'

function TestPersonalizadoContent({ params }) {
  const searchParams = useSearchParams()
  const [resolvedParams, setResolvedParams] = useState(null)
  const [temaNumber, setTemaNumber] = useState(null)

  // ✅ RESOLVER PARAMS ASYNC
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)
      
      setResolvedParams(resolved)
      setTemaNumber(tema)
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Test personalizado tema dinámico:', tema)
        console.log('📋 Parámetros URL:', Object.fromEntries(searchParams.entries()))
      }
    }
    
    resolveParams()
  }, [params, searchParams])

  // ✅ EXTRAER CONFIGURACIÓN DE LA URL
  const testConfig = {
    numQuestions: parseInt(searchParams.get('n')) || 10,
    excludeRecent: searchParams.get('exclude_recent') === 'true',
    recentDays: parseInt(searchParams.get('recent_days')) || 15,
    difficultyMode: searchParams.get('difficulty_mode') || 'random',
    // customDifficulty eliminado
    onlyOfficialQuestions: searchParams.get('only_official') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    focusWeakAreas: searchParams.get('focus_weak') === 'true',
    timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')) : null
  }

  // ✅ LOADING STATE
  if (!temaNumber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test personalizado...</p>
        </div>
      </div>
    )
  }

  // ✅ VALIDAR TEMA
  if (isNaN(temaNumber) || temaNumber < 1 || temaNumber > 50) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Válido
          </h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber} no es válido. Debe estar entre 1 y 50.
          </p>
          <a 
            href="/es/auxiliar-administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  return (
    <TestPageWrapper
      testType="personalizado"
      tema={temaNumber}
      testConfig={testConfig}
      customTitle={`Test Personalizado - Tema ${temaNumber}`}
      customDescription={`Test personalizado con ${testConfig.numQuestions} preguntas del Tema ${temaNumber}`}
      customIcon="✨"
      customColor="from-purple-500 to-indigo-600"
    />
  )
}

export default function TestPersonalizadoPage({ params }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando test personalizado...</p>
        </div>
      </div>
    }>
      <TestPersonalizadoContent params={params} />
    </Suspense>
  )
}