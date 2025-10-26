// scripts/migrate-constitucion-sections-ssr.js
// Migrar todas las secciones de la Constitución a SSR

import { writeFile } from 'fs/promises';
import { join } from 'path';

const constitucionSections = [
  'preambulo-y-titulo-preliminar',
  'titulo-i-derechos-y-deberes-fundamentales',
  'titulo-ii-de-la-corona',
  'titulo-iii-de-las-cortes-generales',
  'titulo-iv-del-gobierno-y-la-administracion',
  'titulo-v-relaciones-gobierno-cortes',
  'titulo-vi-del-poder-judicial',
  'titulo-vii-economia-y-hacienda',
  'titulo-viii-organizacion-territorial',
  'titulo-ix-del-tribunal-constitucional',
  'titulo-x-de-la-reforma-constitucional'
];

const sectionSSRPageTemplate = `// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/SECTION_SLUG/page.js
import Link from 'next/link'
import { loadConstitucionSectionData, generateConstitucionSectionMetadata } from '../../../../lib/constitucionSSR'
import { StartTestButton, TabsSection } from './SectionClientComponents'

// Generar metadata dinámicamente para SEO
export async function generateMetadata() {
  const data = await loadConstitucionSectionData('SECTION_SLUG')
  
  if (!data || !data.config) {
    return {
      title: 'Sección no encontrada - Constitución Española 1978',
      description: 'La sección solicitada no fue encontrada.'
    }
  }

  return generateConstitucionSectionMetadata(data.config)
}

// Pre-renderizar datos en el servidor
export default async function SectionPage() {
  const data = await loadConstitucionSectionData('SECTION_SLUG')
  
  if (!data || !data.config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sección no encontrada</h1>
          <p className="text-gray-600 mb-4">La sección solicitada no existe.</p>
          <Link 
            href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978"
            className="text-blue-600 hover:text-blue-800"
          >
            Volver a Tests de la Constitución Española 1978
          </Link>
        </div>
      </div>
    )
  }

  const { config: sectionConfig, stats } = data

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
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">🏛️</div>
          <h1 className="text-3xl font-bold mb-4">
            {sectionConfig.title}
          </h1>
          <p className="text-blue-100 text-lg mb-6">
            {sectionConfig.description}
          </p>
          
          <div className="flex justify-center gap-8 mb-8">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">{stats.questionsCount}</div>
              <div className="text-sm text-blue-100">Preguntas</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">{stats.articlesCount}</div>
              <div className="text-sm text-blue-100">Artículos</div>
            </div>
            {sectionConfig.articleRange && (
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">
                  {sectionConfig.articleRange.end - sectionConfig.articleRange.start + 1}
                </div>
                <div className="text-sm text-blue-100">Artículos Total</div>
              </div>
            )}
          </div>

          {/* Botón de inicio del test */}
          <div className="text-center">
            {stats.questionsCount > 0 ? (
              <StartTestButton 
                sectionConfig={sectionConfig}
                questionsCount={stats.questionsCount}
              />
            ) : (
              <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                ⚠️ No hay preguntas disponibles para esta sección aún.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Componente cliente para tabs interactivos */}
      <TabsSection sectionConfig={sectionConfig} />

      {/* Enlaces relacionados */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-100 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4">Tests Relacionados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/test-oposiciones/test-de-la-constitucion-espanola-de-1978"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Volver a todos los tests de la Constitución Española 1978
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}`;

// Template para componentes cliente separados
const clientComponentsTemplate = `// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/SECTION_SLUG/SectionClientComponents.js
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
      selectedLaws: ['Constitución Española'],
      selectedArticlesByLaw: sectionConfig.articleRange ? {
        'Constitución Española': Array.from(
          { length: sectionConfig.articleRange.end - sectionConfig.articleRange.start + 1 }, 
          (_, i) => String(sectionConfig.articleRange.start + i)
        )
      } : {},
      customNavigationLinks: {
        backToLaw: {
          href: '/test-oposiciones/test-de-la-constitucion-espanola-de-1978',
          text: 'Volver a Tests de la Constitución Española 1978'
        }
      }
    }

    return (
      <TestPageWrapper
        testType="personalizado"
        tema={null}
        defaultConfig={testConfig}
        customTitle={\`Test: \${sectionConfig.title}\`}
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
          className={\`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-colors duration-200 \${
            activeTab === 'overview'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }\`}
        >
          📊 Información del Test
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={\`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-colors duration-200 \${
            activeTab === 'content'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }\`}
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

export default SectionClientComponents`;

async function migrateSectionToSSR(sectionSlug) {
  try {
    const basePath = join(process.cwd(), 'app', 'test-oposiciones', 'test-de-la-constitucion-espanola-de-1978', sectionSlug);
    
    // Crear contenido específico para esta sección
    const pageContent = sectionSSRPageTemplate.replace(/SECTION_SLUG/g, sectionSlug);
    const clientContent = clientComponentsTemplate.replace(/SECTION_SLUG/g, sectionSlug);
    
    // Escribir el archivo principal (SSR)
    await writeFile(join(basePath, 'page.js'), pageContent, 'utf8');
    
    // Escribir los componentes cliente
    await writeFile(join(basePath, 'SectionClientComponents.js'), clientContent, 'utf8');
    
    console.log(`✅ Migrado a SSR: ${sectionSlug}`);
    
  } catch (error) {
    console.error(`❌ Error migrando ${sectionSlug}:`, error.message);
  }
}

async function migrateAllConstitucionSectionsSSR() {
  console.log('🏛️ Migrando todas las secciones de la Constitución a SSR...');
  console.log(`📝 ${constitucionSections.length} secciones a migrar`);
  
  for (const section of constitucionSections) {
    await migrateSectionToSSR(section);
  }
  
  console.log('✅ Todas las secciones han sido migradas a SSR');
  console.log('🎯 Beneficios SSR:');
  console.log('1. ✅ Pre-renderizado en servidor para mejor SEO');
  console.log('2. ✅ Metadata dinámica específica por sección');
  console.log('3. ✅ Mejor indexación de buscadores');
  console.log('4. ✅ Carga inicial más rápida');
  console.log('5. ✅ Patrón híbrido SSR + Client Components');
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateAllConstitucionSectionsSSR();
}

export { migrateAllConstitucionSectionsSSR };