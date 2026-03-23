'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '@/components/TestPageWrapper'

function TestPersonalizadoAleatorioContent() {
  const searchParams = useSearchParams()

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
    positionType: 'administrativo_estado'
  }

  // Nombres de los 45 temas de Administrativo C1
  const themeNames = {
    1: "La Constitución Española de 1978",
    2: "Los derechos y deberes fundamentales",
    3: "El Tribunal Constitucional",
    4: "La Corona",
    5: "Las Cortes Generales",
    6: "El Gobierno",
    7: "La Administración General del Estado",
    8: "La organización territorial del Estado",
    9: "Las Comunidades Autónomas",
    10: "La Administración Local",
    11: "La Unión Europea",
    12: "Atención al ciudadano",
    13: "Los servicios de información administrativa",
    14: "El registro de documentos",
    15: "Los archivos",
    16: "El acto administrativo",
    17: "El procedimiento administrativo común",
    18: "Los recursos administrativos",
    19: "La jurisdicción contencioso-administrativa",
    20: "Los contratos del sector público",
    21: "La responsabilidad de las Administraciones Públicas",
    22: "La potestad sancionadora",
    23: "El personal al servicio de las Administraciones Públicas",
    24: "Acceso al empleo público",
    25: "La provisión de puestos de trabajo",
    26: "Situaciones administrativas",
    27: "Derechos de los empleados públicos",
    28: "Deberes de los empleados públicos",
    29: "El régimen disciplinario",
    30: "El régimen de Seguridad Social",
    31: "Prevención de riesgos laborales",
    32: "El Presupuesto del Estado",
    33: "El ciclo presupuestario",
    34: "El gasto público",
    35: "La contabilidad pública",
    36: "El control del gasto público",
    37: "Las subvenciones públicas",
    38: "Informática básica",
    39: "Sistema operativo Windows",
    40: "Procesador de textos Word",
    41: "Hoja de cálculo Excel",
    42: "Base de datos Access",
    43: "Correo electrónico",
    44: "Internet y navegadores",
    45: "Seguridad informática"
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('🎲 Test aleatorio administrativo')
    console.log('📋 Configuración:', testConfig)
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
            href="/administrativo-estado/test/aleatorio"
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
      testType="aleatorio"
      themes={testConfig.themes}
      defaultConfig={testConfig}
      customTitle={`Test Aleatorio - ${testConfig.themes.length} Temas`}
      customDescription=""
      customSubtitle=""
      customIcon="🎲"
      customColor="from-blue-500 to-indigo-600"
      positionType="administrativo_estado"
    />
  )
}

export default function TestPersonalizadoAleatorioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test aleatorio...</p>
        </div>
      </div>
    }>
      <TestPersonalizadoAleatorioContent />
    </Suspense>
  )
}
