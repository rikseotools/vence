// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-x-de-la-reforma-constitucional/page.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../../lib/supabase'
import TestPageWrapper from '../../../../components/TestPageWrapper'

const supabase = getSupabaseClient()

export default function TituloXReformaConstitucionalPage() {
  const [loading, setLoading] = useState(true)
  const [showTest, setShowTest] = useState(false)
  const [stats, setStats] = useState(null)

  const sectionConfig = {
    title: 'Título X. De la reforma constitucional',
    description: 'Test del Título X sobre la reforma constitucional (Art. 166-169)',
    lawId: '6ad91a6c-41ec-431f-9c80-5f5566834941',
    articleRange: { start: 166, end: 169 },
    slug: 'titulo-x-de-la-reforma-constitucional'
  }

  useEffect(() => {
    loadSectionStats()
  }, [])

  const loadSectionStats = async () => {
    try {
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
    const testConfig = {
      numQuestions: Math.min(stats?.questionsCount || 10, 20),
      excludeRecent: false,
      recentDays: 30,
      difficultyMode: 'random',
      adaptive: true,
      onlyOfficialQuestions: false,
      selectedLaws: ['CE'],
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
        customIcon="🔧"
        customColor="from-teal-500 to-cyan-600"
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex text-sm text-gray-600">
            <Link href="/test-oposiciones" className="hover:text-blue-600">Tests de Oposiciones</Link>
            <span className="mx-2">›</span>
            <Link href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978" className="hover:text-blue-600">Constitución Española 1978</Link>
            <span className="mx-2">›</span>
            <span className="font-medium text-gray-900">{sectionConfig.title}</span>
          </nav>
        </div>
      </div>

      <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">🔧</div>
          <h1 className="text-3xl font-bold mb-4">{sectionConfig.title}</h1>
          <p className="text-teal-100 text-lg mb-6">{sectionConfig.description}</p>
          
          {!loading && stats && (
            <div className="flex justify-center gap-8 mb-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.questionsCount}</div>
                <div className="text-sm text-teal-100">Preguntas</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.articlesCount}</div>
                <div className="text-sm text-teal-100">Artículos</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">4</div>
                <div className="text-sm text-teal-100">Artículos</div>
              </div>
            </div>
          )}

          <div className="text-center">
            {loading ? (
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            ) : stats && stats.questionsCount > 0 ? (
              <button
                onClick={handleStartTest}
                className="bg-white text-teal-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg"
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

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contenido del Test</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">📍 Artículos del Título X</h3>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">Art. 166 - Iniciativa de reforma</h4>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">Art. 167 - Procedimiento ordinario</h4>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">Art. 168 - Procedimiento agravado</h4>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">Art. 169 - Límites temporales</h4>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">🎯 Temas Principales</h3>
              <ul className="text-gray-600 text-sm space-y-2">
                <li className="flex items-start">
                  <span className="text-teal-500 mr-2 mt-1">•</span>
                  <span>Iniciativa de reforma constitucional</span>
                </li>
                <li className="flex items-start">
                  <span className="text-teal-500 mr-2 mt-1">•</span>
                  <span>Procedimiento ordinario de reforma</span>
                </li>
                <li className="flex items-start">
                  <span className="text-teal-500 mr-2 mt-1">•</span>
                  <span>Procedimiento agravado para reformas totales</span>
                </li>
                <li className="flex items-start">
                  <span className="text-teal-500 mr-2 mt-1">•</span>
                  <span>Límites temporales a la reforma</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Artículos Clave para Oposiciones</h2>
          
          <div className="space-y-6">
            <div className="border-l-4 border-teal-500 pl-4">
              <h3 className="font-bold text-lg text-gray-900 mb-2">Art. 167 - Procedimiento ordinario</h3>
              <div className="space-y-2">
                <p className="text-gray-700">• Mayoría de 3/5 de cada una de las Cámaras</p>
                <p className="text-gray-700">• Si no hay acuerdo, Comisión paritaria</p>
                <p className="text-gray-700">• Ratificación por mayoría absoluta del Senado</p>
                <p className="text-gray-700">• Referéndum facultativo si lo solicita 1/10 de cualquier Cámara</p>
              </div>
            </div>
            
            <div className="border-l-4 border-teal-500 pl-4">
              <h3 className="font-bold text-lg text-gray-900 mb-2">Art. 168 - Procedimiento agravado</h3>
              <div className="space-y-2">
                <p className="text-gray-700">• Para revisión total o que afecte al Título Preliminar, Capítulo 2º Sección 1ª del Título I, o Título II</p>
                <p className="text-gray-700">• Mayoría de 2/3 de cada Cámara</p>
                <p className="text-gray-700">• Disolución inmediata de las Cortes</p>
                <p className="text-gray-700">• Nueva ratificación por mayoría de 2/3 de cada Cámara</p>
                <p className="text-gray-700">• Referéndum obligatorio</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4">Tests Relacionados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-iii-de-las-cortes-generales" className="text-blue-600 hover:text-blue-800 font-medium">
              → Título III: De las Cortes Generales
            </Link>
            <Link href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978" className="text-blue-600 hover:text-blue-800 font-medium">
              → Volver a todos los tests de la Constitución
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}