// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-iii-de-las-cortes-generales/page.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../../lib/supabase'
import TestPageWrapper from '../../../../components/TestPageWrapper'

const supabase = getSupabaseClient()

export default function TituloIIICortesgeneralesPage() {
  const [loading, setLoading] = useState(true)
  const [showTest, setShowTest] = useState(false)
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Configuración específica para esta sección
  const sectionConfig = {
    title: 'Título III. De las Cortes Generales',
    description: 'Test del Título III sobre las Cortes Generales (Art. 66-96)',
    lawId: '6ad91a6c-41ec-431f-9c80-5f5566834941', // ID de la Constitución
    articleRange: { start: 66, end: 96 },
    slug: 'titulo-iii-de-las-cortes-generales',
    chapters: [
      'Capítulo 1º. De las Cámaras',
      'Capítulo 2º. De la elaboración de las leyes',
      'Capítulo 3º. De los Tratados Internacionales'
    ]
  }

  useEffect(() => {
    loadSectionStats()
  }, [])

  const loadSectionStats = async () => {
    try {
      // Obtener preguntas específicas de esta sección (artículos 66-96)
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
        customIcon="🏛️"
        customColor="from-blue-500 to-indigo-600"
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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">🏛️</div>
          <h1 className="text-3xl font-bold mb-4">
            {sectionConfig.title}
          </h1>
          <p className="text-blue-100 text-lg mb-6">
            {sectionConfig.description}
          </p>
          
          {!loading && stats && (
            <div className="flex justify-center gap-8 mb-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.questionsCount}</div>
                <div className="text-sm text-blue-100">Preguntas</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.articlesCount}</div>
                <div className="text-sm text-blue-100">Artículos</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{sectionConfig.chapters.length}</div>
                <div className="text-sm text-blue-100">Capítulos</div>
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
                className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg"
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

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white border-b border-gray-200">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Resumen
            </button>
            <button
              onClick={() => setActiveTab('chapters')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chapters'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📚 Capítulos
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Contenido del Test
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📍 Estructura del Título III</h3>
                <div className="space-y-3">
                  {sectionConfig.chapters.map((chapter, idx) => (
                    <div key={idx} className="bg-gray-50 rounded p-3">
                      <h4 className="font-medium text-gray-800 text-sm">{chapter}</h4>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🎯 Temas Principales</h3>
                <ul className="text-gray-600 text-sm space-y-2">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">•</span>
                    <span>Congreso de los Diputados y Senado</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">•</span>
                    <span>Elecciones y estatuto de diputados y senadores</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">•</span>
                    <span>Funcionamiento de las Cámaras</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">•</span>
                    <span>Procedimiento legislativo</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">•</span>
                    <span>Leyes orgánicas y ordinarias</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">•</span>
                    <span>Tratados internacionales</span>
                  </li>
                </ul>
                
                <h3 className="font-semibold text-gray-900 mb-2 mt-4">📊 Características del Test</h3>
                <ul className="text-gray-600 text-sm space-y-1">
                  <li className="flex items-center">
                    <span className="text-blue-500 mr-2">✓</span>
                    Artículos 66-96
                  </li>
                  <li className="flex items-center">
                    <span className="text-blue-500 mr-2">✓</span>
                    3 capítulos específicos
                  </li>
                  <li className="flex items-center">
                    <span className="text-blue-500 mr-2">✓</span>
                    Modo adaptativo
                  </li>
                  <li className="flex items-center">
                    <span className="text-blue-500 mr-2">✓</span>
                    Explicaciones detalladas
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chapters' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Capítulos del Título III
            </h2>
            
            <div className="space-y-6">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Capítulo 1º - De las Cámaras</h3>
                <p className="text-gray-600 mb-3">Artículos 66-80</p>
                <div className="space-y-2">
                  <p className="text-gray-700">• Representación popular y composición de las Cortes</p>
                  <p className="text-gray-700">• Elecciones al Congreso y Senado</p>
                  <p className="text-gray-700">• Estatuto de los miembros de las Cortes</p>
                  <p className="text-gray-700">• Funcionamiento de las Cámaras</p>
                </div>
              </div>
              
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Capítulo 2º - De la elaboración de las leyes</h3>
                <p className="text-gray-600 mb-3">Artículos 81-92</p>
                <div className="space-y-2">
                  <p className="text-gray-700">• Leyes orgánicas y ordinarias</p>
                  <p className="text-gray-700">• Iniciativa legislativa</p>
                  <p className="text-gray-700">• Procedimiento legislativo</p>
                  <p className="text-gray-700">• Sanción, promulgación y publicación</p>
                </div>
              </div>
              
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Capítulo 3º - De los Tratados Internacionales</h3>
                <p className="text-gray-600 mb-3">Artículos 93-96</p>
                <div className="space-y-2">
                  <p className="text-gray-700">• Autorización de tratados internacionales</p>
                  <p className="text-gray-700">• Cesión de competencias a organizaciones internacionales</p>
                  <p className="text-gray-700">• Jerarquía de los tratados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enlaces relacionados */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4">Tests Relacionados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-iv-del-gobierno-y-la-administracion"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Título IV: Del Gobierno y la Administración
            </Link>
            <Link
              href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-v-relaciones-gobierno-cortes"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Título V: Relaciones entre el Gobierno y las Cortes
            </Link>
            <Link
              href="/auxiliar-administrativo-estado/test/tema/3"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Test Tema 3: Las Cortes Generales (Auxiliar Administrativo)
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