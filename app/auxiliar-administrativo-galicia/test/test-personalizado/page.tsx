// app/auxiliar-administrativo-galicia/test/test-personalizado/page.tsx
'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '@/components/TestPageWrapper'
import { OPOSICION_BLOCKS_CONFIG } from '@/lib/api/random-test/schemas'

// Obtener nombres de temas desde la configuracion
const config = OPOSICION_BLOCKS_CONFIG['auxiliar-administrativo-galicia']
const themeNames: Record<number, string> = {}
config.blocks.forEach(block => {
  block.themes.forEach(theme => {
    themeNames[theme.id] = theme.name
  })
})

function TestPersonalizadoContent() {
  const searchParams = useSearchParams()

  const testConfig = {
    numQuestions: parseInt(searchParams.get('n') || '20'),
    themes: searchParams.get('themes')?.split(',').map(t => parseInt(t)) || [],
    difficulty: searchParams.get('difficulty') || 'mixed',
    mode: searchParams.get('mode') || 'aleatorio',
    excludeRecent: searchParams.get('exclude_recent') === 'true',
    excludeDays: parseInt(searchParams.get('exclude_days') || '15'),
    onlyOfficialQuestions: searchParams.get('official_only') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    focusWeakAreas: searchParams.get('focus_weak') === 'true',
    timeLimit: null,
    testMode: searchParams.get('test_mode') || 'practice',
  }

  if (!testConfig.themes || testConfig.themes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Configuracion No Valida
          </h1>
          <p className="text-gray-600 mb-6">
            No se han seleccionado temas para el test aleatorio.
          </p>
          <a
            href="/auxiliar-administrativo-galicia/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  return (
    // @ts-expect-error - TestPageWrapper is a JS component without proper types
    <TestPageWrapper
      tema={0}
      testType="aleatorio"
      themes={testConfig.themes}
      defaultConfig={testConfig}
      customTitle={`Test Aleatorio - ${testConfig.themes.length} Temas`}
      customDescription=""
      customSubtitle=""
      customIcon={'\ud83c\udfb2'}
      customColor="from-sky-500 to-sky-600"
      positionType="auxiliar_administrativo_galicia"
      loadingMessage="Cargando preguntas..."
      errorMessage="Error al cargar las preguntas"
    />
  )
}

export default function TestPersonalizadoGaliciaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Preparando test aleatorio...</p>
          </div>
        </div>
      }
    >
      <TestPersonalizadoContent />
    </Suspense>
  )
}
