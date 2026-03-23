// app/[oposicion]/test/test-personalizado/page.tsx
// Ruta dinámica universal para test personalizado de todas las oposiciones.
// Reemplaza las 17 páginas individuales con una sola ruta dinámica.
// El positionType se deriva automáticamente del slug vía config central.
'use client'

import { Suspense } from 'react'
import { useSearchParams, useParams, notFound } from 'next/navigation'
import TestPageWrapper from '@/components/TestPageWrapper'
import { OPOSICION_BLOCKS_CONFIG } from '@/lib/api/random-test/schemas'
import { SLUG_TO_POSITION_TYPE, getOposicion } from '@/lib/config/oposiciones'

function TestPersonalizadoContent() {
  const searchParams = useSearchParams()
  const params = useParams()
  const slug = params.oposicion as string

  // Validar que la oposición existe
  const positionType = SLUG_TO_POSITION_TYPE[slug]
  const oposicionConfig = getOposicion(slug)

  if (!positionType || !oposicionConfig) {
    notFound()
  }

  // Obtener nombres de temas desde la configuración central
  const blocksConfig = OPOSICION_BLOCKS_CONFIG[slug]
  const themeNames: Record<number, string> = {}
  if (blocksConfig) {
    blocksConfig.blocks.forEach((block: { themes: Array<{ id: number; name: string }> }) => {
      block.themes.forEach(theme => {
        themeNames[theme.id] = theme.name
      })
    })
  }

  // Extraer configuración de la URL
  const testConfig = {
    numQuestions: parseInt(searchParams.get('n') ?? '20'),
    themes: searchParams.get('themes')?.split(',').map(t => parseInt(t)) || [],
    difficulty: searchParams.get('difficulty') || 'mixed',
    mode: searchParams.get('mode') || 'aleatorio',
    excludeRecent: searchParams.get('exclude_recent') === 'true',
    excludeDays: parseInt(searchParams.get('exclude_days') ?? '15'),
    onlyOfficialQuestions: searchParams.get('official_only') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    focusWeakAreas: searchParams.get('focus_weak') === 'true',
    timeLimit: null,
    testMode: searchParams.get('test_mode') || 'practice',
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
            No se han seleccionado temas para el test aleatorio.
          </p>
          <a
            href={`/${slug}/test/aleatorio`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  return (
    <TestPageWrapper
      tema={0}
      testType="aleatorio"
      themes={testConfig.themes}
      defaultConfig={testConfig}
      customTitle={`Test Aleatorio - ${testConfig.themes.length} Temas`}
      customDescription=""
      customSubtitle=""
      customIcon="🎲"
      customColor="from-blue-500 to-indigo-600"
      positionType={positionType}
      loadingMessage="Cargando preguntas..."
      errorMessage="Error al cargar las preguntas"
    />
  )
}

export default function TestPersonalizadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Preparando test aleatorio...</p>
          </div>
        </div>
      }
    >
      <TestPersonalizadoContent />
    </Suspense>
  )
}
