// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/preambulo-y-titulo-preliminar/page.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../../lib/supabase'
import TestPageWrapper from '../../../../components/TestPageWrapper'

const supabase = getSupabaseClient()

export default function PreambuloyTituloPreliminarPage() {
  const [loading, setLoading] = useState(true)
  const [showTest, setShowTest] = useState(false)
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('preambulo')

  // Configuración específica para esta sección
  const sectionConfig = {
    title: 'Preámbulo y Título Preliminar',
    description: 'Test del Preámbulo y Título Preliminar de la Constitución Española (Art. 1-9)',
    lawId: '6ad91a6c-41ec-431f-9c80-5f5566834941', // ID de la Constitución
    articleRange: { start: 1, end: 9 },
    slug: 'preambulo-y-titulo-preliminar'
  }

  useEffect(() => {
    loadSectionStats()
  }, [])

  const loadSectionStats = async () => {
    try {
      // Obtener preguntas específicas de esta sección (artículos 1-9)
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('id, article_number')
        .eq('law_id', sectionConfig.lawId)
        .in('article_number', ['1', '2', '3', '4', '5', '6', '7', '8', '9'])

      if (articlesError) {
        console.error('Error cargando artículos:', articlesError)
        setStats({ questionsCount: 0, articlesCount: 0 })
      } else {
        console.log('🔍 Artículos encontrados para rango 1-9:', articles?.map(a => a.article_number))
        
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
              console.log(`📝 Artículo ${article.article_number}: ${questions.length} preguntas`)
              totalQuestions += questions.length
            }
          }
        }

        console.log('📊 Totales: Artículos =', articles?.length || 0, 'Preguntas =', totalQuestions)
        
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
      }
    }

    return (
      <TestPageWrapper
        testType="personalizado"
        tema={null}
        defaultConfig={testConfig}
        customTitle={`Test: ${sectionConfig.title}`}
        customDescription={sectionConfig.description}
        customIcon="📜"
        customColor="from-blue-500 to-indigo-600"
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-4">
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
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">📜</div>
          <h1 className="text-3xl font-bold mb-4">
            PREÁMBULO Y TÍTULO PRELIMINAR
          </h1>
          <p className="text-blue-100 text-lg mb-6">
            Test del Preámbulo y Título Preliminar de la Constitución Española (Art. 1-9)
          </p>
          
          {!loading && stats && (
            <div className="flex justify-center gap-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.questionsCount}</div>
                <div className="text-sm text-blue-100">Preguntas</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.articlesCount}</div>
                <div className="text-sm text-blue-100">Artículos</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Panel izquierdo - Contenido educativo */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  <button
                    onClick={() => setActiveTab('preambulo')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'preambulo'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    PREÁMBULO
                  </button>
                  <button
                    onClick={() => setActiveTab('titulo-preliminar')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'titulo-preliminar'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    TÍTULO PRELIMINAR
                  </button>
                </nav>
              </div>

              {/* Contenido de las tabs */}
              <div className="p-6">
                {activeTab === 'preambulo' && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">PREÁMBULO</h2>
                    <div className="prose max-w-none text-gray-700">
                      <p className="mb-4">
                        La Nación española, deseando establecer la justicia, la libertad y la seguridad y promover el bien de cuantos la integran, en uso de su soberanía, proclama su voluntad de:
                      </p>
                      <ul className="space-y-2 mb-4">
                        <li>• Garantizar la convivencia democrática dentro de la Constitución y de las leyes conforme a un orden económico y social justo.</li>
                        <li>• Consolidar un Estado de Derecho que asegure el imperio de la ley como expresión de la voluntad popular.</li>
                        <li>• Proteger a todos los españoles y pueblos de España en el ejercicio de los derechos humanos, sus culturas y tradiciones, lenguas e instituciones.</li>
                        <li>• Promover el progreso de la cultura y de la economía para asegurar a todos una digna calidad de vida.</li>
                        <li>• Establecer una sociedad democrática avanzada, y</li>
                        <li>• Colaborar en el fortalecimiento de unas relaciones pacíficas y de eficaz cooperación entre todos los pueblos de la Tierra.</li>
                      </ul>
                      <p>
                        En consecuencia, las Cortes aprueban y el pueblo español ratifica la siguiente
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'titulo-preliminar' && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">TÍTULO PRELIMINAR</h2>
                    <div className="prose max-w-none text-gray-700">
                      <div className="space-y-6">
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 1</h3>
                          <p>1. España se constituye en un Estado social y democrático de Derecho, que propugna como valores superiores de su ordenamiento jurídico la libertad, la justicia, la igualdad y el pluralismo político.</p>
                          <p>2. La soberanía nacional reside en el pueblo español, del que emanan los poderes del Estado.</p>
                          <p>3. La forma política del Estado español es la Monarquía parlamentaria.</p>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 2</h3>
                          <p>La Constitución se fundamenta en la indisoluble unidad de la Nación española, patria común e indivisible de todos los españoles, y reconoce y garantiza el derecho a la autonomía de las nacionalidades y regiones que la integran y la solidaridad entre todas ellas.</p>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 3</h3>
                          <p>1. El castellano es la lengua española oficial del Estado. Todos los españoles tienen el deber de conocerla y el derecho a usarla.</p>
                          <p>2. Las demás lenguas españolas serán también oficiales en las respectivas Comunidades Autónomas de acuerdo con sus Estatutos.</p>
                          <p>3. La riqueza de las distintas modalidades lingüísticas de España es un patrimonio cultural que será objeto de especial respeto y protección.</p>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 4</h3>
                          <p>1. La bandera de España está formada por tres franjas horizontales, roja, amarilla y roja, siendo la amarilla de doble anchura que cada una de las rojas.</p>
                          <p>2. Los Estatutos podrán reconocer banderas y enseñas propias de las Comunidades Autónomas. Estas se utilizarán junto a la bandera de España en sus edificios públicos y en sus actos oficiales.</p>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 5</h3>
                          <p>La capital del Estado es la villa de Madrid.</p>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 6</h3>
                          <p>Los partidos políticos expresan el pluralismo político, concurren a la formación y manifestación de la voluntad popular y son instrumento fundamental para la participación política. Su creación y el ejercicio de su actividad son libres dentro del respeto a la Constitución y a la ley. Su estructura interna y funcionamiento deberán ser democráticos.</p>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 7</h3>
                          <p>Los sindicatos de trabajadores y las asociaciones empresariales contribuyen a la defensa y promoción de los intereses económicos y sociales que les son propios. Su creación y el ejercicio de su actividad son libres dentro del respeto a la Constitución y a la ley. Su estructura interna y funcionamiento deberán ser democráticos.</p>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 8</h3>
                          <p>1. Las Fuerzas Armadas, constituidas por el Ejército de Tierra, la Armada y el Ejército del Aire, tienen como misión garantizar la soberanía e independencia de España, defender su integridad territorial y el ordenamiento constitucional.</p>
                          <p>2. Una ley orgánica regulará las bases de la organización militar conforme a los principios de la presente Constitución.</p>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Artículo 9</h3>
                          <p>1. Los ciudadanos y los poderes públicos están sujetos a la Constitución y al resto del ordenamiento jurídico.</p>
                          <p>2. Corresponde a los poderes públicos promover las condiciones para que la libertad e igualdad del individuo y de los grupos en que se integra sean reales y efectivas; remover los obstáculos que impidan o dificulten su plenitud y facilitar la participación de todos los ciudadanos en la vida política, económica, cultural y social.</p>
                          <p>3. La Constitución garantiza el principio de legalidad, la jerarquía normativa, la publicidad de las normas, la irretroactividad de las disposiciones sancionadoras no favorables o restrictivas de derechos individuales, la seguridad jurídica, la responsabilidad y la interdicción de la arbitrariedad de los poderes públicos.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel derecho - Test */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 Realizar Test</h3>
              
              {!loading && stats && (
                <div className="mb-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Preguntas disponibles:</span>
                    <span className="font-semibold text-blue-600">{stats.questionsCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Artículos:</span>
                    <span className="font-semibold text-gray-900">1-9</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Modo adaptativo:</span>
                    <span className="text-green-600 text-sm">✓ Disponible</span>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Cargando estadísticas...</p>
                </div>
              ) : stats && stats.questionsCount > 0 ? (
                <button
                  onClick={handleStartTest}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-lg transition-colors duration-200"
                >
                  🚀 Empezar Test
                  <div className="text-sm font-normal mt-1">
                    {stats.questionsCount} preguntas disponibles
                  </div>
                </button>
              ) : (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded text-center">
                  <p className="text-sm">⚠️ No hay preguntas disponibles para esta sección aún.</p>
                </div>
              )}

              {/* Enlaces relacionados */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">Tests Relacionados</h4>
                <div className="space-y-2">
                  <Link
                    href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-i-derechos-y-deberes-fundamentales"
                    className="block text-blue-600 hover:text-blue-800 text-sm"
                  >
                    → Título I: Derechos fundamentales
                  </Link>
                  <Link
                    href="/auxiliar-administrativo-estado/test/tema/1"
                    className="block text-blue-600 hover:text-blue-800 text-sm"
                  >
                    → Tema 1: La Constitución (Auxiliar)
                  </Link>
                  <Link
                    href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978"
                    className="block text-blue-600 hover:text-blue-800 text-sm"
                  >
                    → Todos los tests Constitución
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}