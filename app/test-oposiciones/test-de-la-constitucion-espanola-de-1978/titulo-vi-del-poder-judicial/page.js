// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-vi-del-poder-judicial/page.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../../lib/supabase'
import TestPageWrapper from '../../../../components/TestPageWrapper'

const supabase = getSupabaseClient()

export default function TituloVIPoderJudicialPage() {
  const [loading, setLoading] = useState(true)
  const [showTest, setShowTest] = useState(false)
  const [stats, setStats] = useState(null)

  // Configuración específica para esta sección
  const sectionConfig = {
    title: 'Título VI. Del Poder Judicial',
    description: 'Test del Título VI sobre el Poder Judicial (Art. 117-127)',
    lawId: '6ad91a6c-41ec-431f-9c80-5f5566834941', // ID de la Constitución
    articleRange: { start: 117, end: 127 },
    slug: 'titulo-vi-del-poder-judicial'
  }

  useEffect(() => {
    loadSectionStats()
  }, [])

  const loadSectionStats = async () => {
    try {
      // Obtener preguntas específicas de esta sección (artículos 117-127)
      const articleNumbers = Array.from(
        { length: sectionConfig.articleRange.end - sectionConfig.articleRange.start + 1 }, 
        (_, i) => String(sectionConfig.articleRange.start + i)
      )
      
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', sectionConfig.lawId)
        .in('article_number', articleNumbers)

      if (articlesError) {
        console.error('Error cargando artículos:', articlesError)
        setStats({ questionsCount: 0 })
      } else {
        // Contar preguntas de estos artículos
        let totalQuestions = 0
        
        if (articles && articles.length > 0) {
          for (const article of articles) {
            const { data: questions, error: questionsError } = await supabase
              .from('questions')
              .select('id')
              .eq('primary_article_id', article.id)
              .eq('is_active', true)

            if (!questionsError && questions) {
              totalQuestions += questions.length
            }
          }
        }

        setStats({
          questionsCount: totalQuestions,
          articlesCount: articles?.length || 0
        })
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
      setStats({ questionsCount: 0 })
    } finally {
      setLoading(false)
    }
  }

  const handleStartTest = () => {
    setShowTest(true)
  }

  if (showTest) {
    // Configuración del test para esta sección específica
    const testConfig = {
      numQuestions: Math.min(stats?.questionsCount || 10, 20),
      excludeRecent: false,
      recentDays: 30,
      difficultyMode: 'random',
      adaptive: true,
      onlyOfficialQuestions: false,
      selectedLaws: ['CE'], // Solo Constitución
      selectedArticlesByLaw: {
        'CE': Array.from(
          { length: sectionConfig.articleRange.end - sectionConfig.articleRange.start + 1 }, 
          (_, i) => String(sectionConfig.articleRange.start + i)
        )
      },
      customNavigationLinks: {
        backToLaw: {
          href: '/test-oposiciones/test-de-la-constitucion-espanola-de-1978',
          text: 'Volver a Tests de la Constitución'
        }
      }
    }

    return (
      <TestPageWrapper
        testType="personalizado"
        tema={null}
        defaultConfig={testConfig}
        customTitle={`Test: ${sectionConfig.title}`}
        customDescription={sectionConfig.description}
        customIcon="⚖️"
        customColor="from-indigo-500 to-purple-600"
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex text-sm text-gray-600">
            <Link href="/test-oposiciones" className="hover:text-blue-600">
              Tests de Oposiciones
            </Link>
            <span className="mx-2">›</span>
            <Link href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978" className="hover:text-blue-600">
              Constitución Española 1978
            </Link>
            <span className="mx-2">›</span>
            <span className="font-medium text-gray-900">
              {sectionConfig.title}
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">⚖️</div>
          <h1 className="text-3xl font-bold mb-4">
            {sectionConfig.title}
          </h1>
          <p className="text-indigo-100 text-lg mb-6">
            {sectionConfig.description}
          </p>
          
          {!loading && stats && (
            <div className="flex justify-center gap-8 mb-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.questionsCount}</div>
                <div className="text-sm text-indigo-100">Preguntas</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.articlesCount}</div>
                <div className="text-sm text-indigo-100">Artículos</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">11</div>
                <div className="text-sm text-indigo-100">Artículos</div>
              </div>
            </div>
          )}

          {/* Botón de inicio del test */}
          <div className="text-center">
            {loading ? (
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            ) : stats && stats.questionsCount > 0 ? (
              <button
                onClick={handleStartTest}
                className="bg-white text-indigo-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg"
              >
                🚀 Empezar Test ({stats.questionsCount} preguntas)
              </button>
            ) : (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                ⚠️ No hay preguntas disponibles para esta sección aún.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Contenido del Test
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">📍 Artículos del Título VI</h3>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">Art. 117 - Justicia y tribunales</h4>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">Art. 118-119 - Obligatorio cumplimiento</h4>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">Art. 120-121 - Actuaciones judiciales</h4>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">Art. 122-127 - CGPJ y organización</h4>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">🎯 Temas Principales</h3>
              <ul className="text-gray-600 text-sm space-y-2">
                <li className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-1">•</span>
                  <span>Justicia como poder del Estado</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-1">•</span>
                  <span>Independencia judicial</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-1">•</span>
                  <span>Principio de unidad jurisdiccional</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-1">•</span>
                  <span>Consejo General del Poder Judicial</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-1">•</span>
                  <span>Estatuto de jueces y magistrados</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-1">•</span>
                  <span>Tribunal Supremo</span>
                </li>
              </ul>
              
              <h3 className="font-semibold text-gray-900 mb-2 mt-4">📊 Características del Test</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li className="flex items-center">
                  <span className="text-indigo-500 mr-2">✓</span>
                  Artículos 117-127
                </li>
                <li className="flex items-center">
                  <span className="text-indigo-500 mr-2">✓</span>
                  Fundamental para Auxiliar Justicia
                </li>
                <li className="flex items-center">
                  <span className="text-indigo-500 mr-2">✓</span>
                  Modo adaptativo
                </li>
                <li className="flex items-center">
                  <span className="text-indigo-500 mr-2">✓</span>
                  Explicaciones detalladas
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Contenido educativo */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Artículos Clave para Oposiciones
          </h2>
          
          <div className="space-y-6">
            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-bold text-lg text-gray-900 mb-2">Art. 117 - La justicia</h3>
              <div className="space-y-2">
                <p className="text-gray-700">• La justicia emana del pueblo y se administra por Jueces y Magistrados</p>
                <p className="text-gray-700">• Integrantes del Poder Judicial independientes, inamovibles, responsables y sometidos únicamente al imperio de la ley</p>
                <p className="text-gray-700">• Prohibición de Tribunales de excepción</p>
              </div>
            </div>
            
            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-bold text-lg text-gray-900 mb-2">Art. 122 - Consejo General del Poder Judicial</h3>
              <div className="space-y-2">
                <p className="text-gray-700">• Órgano de gobierno del Poder Judicial</p>
                <p className="text-gray-700">• Compuesto por el Presidente del Tribunal Supremo y 20 miembros</p>
                <p className="text-gray-700">• 12 entre Jueces y Magistrados y 8 entre abogados y juristas</p>
                <p className="text-gray-700">• Nombrados por las Cortes Generales por mayoría de 3/5</p>
              </div>
            </div>
            
            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-bold text-lg text-gray-900 mb-2">Art. 123 - Tribunal Supremo</h3>
              <p className="text-gray-700">Órgano jurisdiccional superior en todos los órdenes, salvo lo dispuesto en materia de garantías constitucionales.</p>
            </div>
          </div>
        </div>

        {/* Enlaces relacionados */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4">Tests Relacionados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-ix-del-tribunal-constitucional"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Título IX: Del Tribunal Constitucional
            </Link>
            <Link
              href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-i-derechos-y-deberes-fundamentales"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Título I: Derechos y deberes fundamentales
            </Link>
            <Link
              href="/auxiliar-administrativo-justicia/test/tema/7"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Test Tema 7: El Poder Judicial (Auxiliar Justicia)
            </Link>
            <Link
              href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Volver a todos los tests de la Constitución
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}