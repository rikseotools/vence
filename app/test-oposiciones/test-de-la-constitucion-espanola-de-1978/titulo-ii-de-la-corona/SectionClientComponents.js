// app/test-oposiciones/constitucion-titulos/titulo-ii-de-la-corona/SectionClientComponents.js
'use client'
import { useState } from 'react'
import TestPageWrapper from '../../../../components/TestPageWrapper'

// Componente cliente para el botón de test
function StartTestButton({ sectionConfig, questionsCount }) {
  const [showTest, setShowTest] = useState(false)

  const handleStartTest = () => {
    setShowTest(true)
  }

  if (showTest) {
    // Configuración del test para esta sección específica
    const testConfig = {
      numQuestions: Math.min(questionsCount || 10, 20),
      excludeRecent: false,
      recentDays: 30,
      difficultyMode: 'random',
      adaptive: true,
      onlyOfficialQuestions: false,
      selectedLaws: ['CE'],
      selectedArticlesByLaw: sectionConfig.articleRange ? {
        'CE': Array.from(
          { length: sectionConfig.articleRange.end - sectionConfig.articleRange.start + 1 }, 
          (_, i) => String(sectionConfig.articleRange.start + i)
        )
      } : {},
      customNavigationLinks: {
        backToLaw: {
          href: '/test-oposiciones/constitucion-titulos',
          text: 'Volver a Tests de la Constitución Española 1978',
          label: 'Volver a Tests de la Constitución Española 1978',
          label: 'Volver a Tests de la Constitución Española 1978'
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
        customColor="from-blue-500 to-blue-700"
      />
    )
  }

  return (
    <button
      onClick={handleStartTest}
      className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg"
    >
      🚀 Empezar Test ({questionsCount} preguntas)
    </button>
  )
}

// Componente cliente para tabs interactivos
function TabsSection({ sectionConfig }) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeTab === 'overview'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Información del Test
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeTab === 'content'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📖 Ver Contenido
        </button>
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Contenido del Test
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">📍 Artículos de esta sección</h3>
              {sectionConfig.articleRange ? (
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">
                    Art. {sectionConfig.articleRange.start}-{sectionConfig.articleRange.end}
                  </h4>
                </div>
              ) : (
                <div className="bg-gray-50 rounded p-3">
                  <h4 className="font-medium text-gray-800 text-sm">
                    Test especializado de la Constitución
                  </h4>
                </div>
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">🎯 Tema Principal</h3>
              <div className="text-gray-600 text-sm">
                <div className="flex items-start">
                  <span className="text-blue-500 mr-2 mt-1">•</span>
                  <span>{sectionConfig.description}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab de contenido */}
      {activeTab === 'content' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📖 Contenido de los Artículos
          </h2>
          
          {sectionConfig.articleRange ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-blue-800">
                  <strong>Artículos {sectionConfig.articleRange.start} al {sectionConfig.articleRange.end}</strong> - {sectionConfig.description}
                </p>
              </div>
              
              <div className="prose max-w-none">
                <p className="text-gray-600 mb-4">
                  Esta sección incluye {sectionConfig.articleRange.end - sectionConfig.articleRange.start + 1} artículos 
                  de la Constitución Española de 1978.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">📋 Rango de artículos:</h4>
                  <p className="text-sm text-gray-600">
                    Del artículo <strong>{sectionConfig.articleRange.start}</strong> al artículo <strong>{sectionConfig.articleRange.end}</strong>
                  </p>
                </div>
                
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Consejo:</strong> Utiliza el tab "Información del Test" para realizar tests específicos 
                    de estos artículos y evaluar tu conocimiento.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-800">
                <strong>Test especializado</strong> - Este test incluye preguntas específicas 
                de esta sección de la Constitución Española.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Exportar componentes
export { StartTestButton, TabsSection }

const SectionClientComponents = {
  StartTestButton,
  TabsSection
}

export default SectionClientComponents