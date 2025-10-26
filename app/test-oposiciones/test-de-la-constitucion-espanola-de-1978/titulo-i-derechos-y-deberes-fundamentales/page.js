// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-i-derechos-y-deberes-fundamentales/page.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../../lib/supabase'
import TestPageWrapper from '../../../../components/TestPageWrapper'

const supabase = getSupabaseClient()

export default function TituloIDerechosDeberesFundamentalesPage() {
  const [loading, setLoading] = useState(true)
  const [showTest, setShowTest] = useState(false)
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Configuración específica para esta sección
  const sectionConfig = {
    title: 'Título I. De los Derechos y deberes fundamentales',
    description: 'Test del Título I sobre derechos y deberes fundamentales (Art. 10-55)',
    lawId: '6ad91a6c-41ec-431f-9c80-5f5566834941', // ID de la Constitución
    articleRange: { start: 10, end: 55 },
    slug: 'titulo-i-derechos-y-deberes-fundamentales',
    chapters: [
      'Capítulo 1º. De los españoles y los extranjeros',
      'Capítulo 2º. Derechos y libertades',
      'Capítulo 3º. De los principios rectores de la política social y económica',
      'Capítulo 4º. De las garantías de las libertades y derechos fundamentales',
      'Capítulo 5º. De la suspensión de los derechos y libertades'
    ]
  }

  useEffect(() => {
    loadSectionStats()
  }, [])

  const loadSectionStats = async () => {
    try {
      // Obtener preguntas específicas de esta sección (artículos 10-55)
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
        customColor="from-red-500 to-pink-600"
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
      <div className="bg-gradient-to-r from-red-600 to-pink-700 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">⚖️</div>
          <h1 className="text-3xl font-bold mb-4">
            {sectionConfig.title}
          </h1>
          <p className="text-red-100 text-lg mb-6">
            {sectionConfig.description}
          </p>
          
          {!loading && stats && (
            <div className="flex justify-center gap-8 mb-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.questionsCount}</div>
                <div className="text-sm text-red-100">Preguntas</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.articlesCount}</div>
                <div className="text-sm text-red-100">Artículos</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{sectionConfig.chapters.length}</div>
                <div className="text-sm text-red-100">Capítulos</div>
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
                className="bg-white text-red-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg"
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
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Resumen
            </button>
            <button
              onClick={() => setActiveTab('chapters')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chapters'
                  ? 'border-red-500 text-red-600'
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
                <h3 className="font-semibold text-gray-900 mb-2">📍 Estructura del Título I</h3>
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
                    <span className="text-red-500 mr-2 mt-1">•</span>
                    <span>Derechos fundamentales y libertades públicas</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2 mt-1">•</span>
                    <span>Igualdad y no discriminación</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2 mt-1">•</span>
                    <span>Libertad personal, ideológica y religiosa</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2 mt-1">•</span>
                    <span>Derecho a la educación</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2 mt-1">•</span>
                    <span>Garantías constitucionales</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2 mt-1">•</span>
                    <span>Suspensión de derechos y libertades</span>
                  </li>
                </ul>
                
                <h3 className="font-semibold text-gray-900 mb-2 mt-4">📊 Características del Test</h3>
                <ul className="text-gray-600 text-sm space-y-1">
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">✓</span>
                    Artículos 10-55
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">✓</span>
                    5 capítulos específicos
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">✓</span>
                    Modo adaptativo
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">✓</span>
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
              Capítulos del Título I
            </h2>
            
            <div className="space-y-6">
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Capítulo 1º - De los españoles y los extranjeros</h3>
                <p className="text-gray-600 mb-3">Artículos 11-13</p>
                <p className="text-gray-700">Nacionalidad española, extranjería y derecho de asilo.</p>
              </div>
              
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Capítulo 2º - Derechos y libertades</h3>
                <p className="text-gray-600 mb-3">Artículos 14-38</p>
                <div className="space-y-2">
                  <p className="text-gray-700 font-medium">Sección 1ª - De los derechos fundamentales y de las libertades públicas (Arts. 15-29)</p>
                  <p className="text-gray-700 font-medium">Sección 2ª - De los derechos y deberes de los ciudadanos (Arts. 30-38)</p>
                </div>
              </div>
              
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Capítulo 3º - Principios rectores de la política social y económica</h3>
                <p className="text-gray-600 mb-3">Artículos 39-52</p>
                <p className="text-gray-700">Protección de la familia, derechos sociales y económicos.</p>
              </div>
              
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Capítulo 4º - Garantías de las libertades y derechos fundamentales</h3>
                <p className="text-gray-600 mb-3">Artículos 53-54</p>
                <p className="text-gray-700">Recurso de amparo, Defensor del Pueblo y garantías constitucionales.</p>
              </div>
              
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Capítulo 5º - Suspensión de los derechos y libertades</h3>
                <p className="text-gray-600 mb-3">Artículo 55</p>
                <p className="text-gray-700">Estados de excepción y sitio, y legislación antiterrorista.</p>
              </div>
            </div>
          </div>
        )}


        {/* Enlaces relacionados */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4">Tests Relacionados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978/preambulo-y-titulo-preliminar"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Preámbulo y Título Preliminar
            </Link>
            <Link
              href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-ii-de-la-corona"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Título II: De la Corona
            </Link>
            <Link
              href="/auxiliar-administrativo-estado/test/tema/1"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Test Tema 1: La Constitución Española (Auxiliar Administrativo)
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