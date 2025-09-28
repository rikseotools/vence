'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '../../../../../components/TestPageWrapper'

function TestPersonalizadoAleatorioContent() {
  const searchParams = useSearchParams()
  
  // ✅ EXTRAER CONFIGURACIÓN DE LA URL
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
    timeLimit: null // Sin límite de tiempo por defecto para tests aleatorios
  }

  const themeNames = {
    1: "La Constitución Española de 1978",
    2: "El Tribunal Constitucional. La Corona",
    3: "Las Cortes Generales",
    4: "El Poder Judicial",
    5: "El Gobierno y la Administración",
    6: "El Gobierno Abierto. Agenda 2030",
    7: "Ley 19/2013 de Transparencia",
    8: "La Administración General del Estado",
    9: "La Organización Territorial del Estado",
    10: "La Organización de la Unión Europea",
    11: "Las Leyes del Procedimiento Administrativo Común",
    12: "La Protección de Datos Personales",
    13: "El Personal Funcionario de las Administraciones Públicas",
    14: "Derechos y Deberes de los Funcionarios",
    15: "El Presupuesto del Estado en España",
    16: "Políticas de Igualdad y contra la Violencia de Género"
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('🎲 Test aleatorio personalizado')
    console.log('📋 Configuración:', testConfig)
  }

  // ✅ VALIDAR CONFIGURACIÓN
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
            href="/es/auxiliar-administrativo-estado/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  const selectedThemeNames = testConfig.themes
    .map(id => themeNames[id])
    .filter(Boolean)
    .join(', ')

  return (
    <TestPageWrapper
      testType="aleatorio"
      themes={testConfig.themes}
      testConfig={testConfig}
      customTitle={`Test Aleatorio - ${testConfig.themes.length} Temas`}
      customDescription=""
      customSubtitle=""
      customIcon="🎲"
      customColor="from-blue-500 to-indigo-600"
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