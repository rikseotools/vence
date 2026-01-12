// app/test/personalizado/page.js - Ruta genérica para test personalizado (modo práctica)
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '@/components/TestPageWrapper'
import { getOposicionConfig, getThemeNames } from '@/lib/config/oposiciones'

function TestPersonalizadoContent() {
  const searchParams = useSearchParams()
  const [oposicionConfig, setOposicionConfig] = useState(null)

  // Extraer configuración de la URL
  const oposicionParam = searchParams.get('oposicion') || 'auxiliar_administrativo'

  const testConfig = {
    numQuestions: parseInt(searchParams.get('n')) || 20,
    themes: searchParams.get('themes')?.split(',').map(t => parseInt(t)) || [],
    difficulty: searchParams.get('difficulty') || 'mixed',
    mode: searchParams.get('mode') || 'aleatorio',
    excludeRecent: searchParams.get('exclude_recent') === 'true',
    excludeDays: parseInt(searchParams.get('exclude_days')) || 15,
    onlyOfficialQuestions: searchParams.get('official_only') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    focusWeakAreas: searchParams.get('focus_weak') === 'true',
    adaptiveMode: searchParams.get('adaptive') === 'true',
    timeLimit: null,
    testMode: searchParams.get('test_mode') || 'practice',
    positionType: oposicionParam
  }

  // Cargar configuración de la oposición
  useEffect(() => {
    const config = getOposicionConfig(oposicionParam)
    if (config) {
      setOposicionConfig(config)
    }
  }, [oposicionParam])

  if (process.env.NODE_ENV === 'development') {
    console.log('🎲 Test personalizado genérico')
    console.log('📋 Configuración:', testConfig)
    console.log('📚 Oposición:', oposicionConfig?.name)
  }

  // Loading state
  if (!oposicionConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  // Validar configuración
  if (!testConfig.themes || testConfig.themes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Configuración No Válida
          </h1>
          <p className="text-gray-600 mb-6">
            No se han seleccionado temas para el test.
          </p>
          <a
            href="/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  // Mapear positionType a formato esperado por TestPageWrapper
  // TestPageWrapper espera 'administrativo' o 'auxiliar_administrativo'
  const positionTypeForWrapper = oposicionConfig.positionType === 'administrativo_estado'
    ? 'administrativo'
    : oposicionConfig.positionType

  return (
    <TestPageWrapper
      testType="aleatorio"
      themes={testConfig.themes}
      testConfig={{
        ...testConfig,
        positionType: positionTypeForWrapper
      }}
      customTitle={`Test Aleatorio - ${testConfig.themes.length} Tema${testConfig.themes.length > 1 ? 's' : ''}`}
      customDescription=""
      customSubtitle={oposicionConfig.shortName}
      customIcon="🎲"
      customColor="from-blue-500 to-indigo-600"
      positionType={positionTypeForWrapper}
    />
  )
}

export default function TestPersonalizadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test...</p>
        </div>
      </div>
    }>
      <TestPersonalizadoContent />
    </Suspense>
  )
}
