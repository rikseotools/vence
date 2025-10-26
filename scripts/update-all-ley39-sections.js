// scripts/update-all-ley39-sections.js
// Actualizar todas las páginas de secciones de la Ley 39/2015 para usar law_sections

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const sections = [
  'titulo-preliminar',
  'titulo-i-capitulo-i-capacidad-obrar-concepto-interesado',
  'titulo-i-capitulo-ii-identificacion-firma-interesados',
  'titulo-ii-capitulo-i-normas-generales-actuacion',
  'titulo-ii-capitulo-ii-terminos-plazos',
  'titulo-iii-capitulo-i-requisitos-actos-administrativos',
  'titulo-iii-capitulo-ii-eficacia-actos',
  'titulo-iii-capitulo-iii-nulidad-anulabilidad',
  'titulo-iv-capitulos-i-ii-garantias-iniciacion',
  'titulo-iv-capitulos-iii-iv-ordenacion-instruccion',
  'titulo-iv-capitulos-v-vi-vii-finalizacion-simplificada-ejecucion',
  'titulo-v-capitulo-i-revision-oficio',
  'titulo-v-capitulo-ii-recursos-administrativos',
  'titulo-vi-iniciativa-legislativa-potestad-reglamentaria',
  'test-plazos'
];

const newPageTemplate = `// app/test-oposiciones/test-ley-39-2015/SECTION_SLUG/page.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../../lib/supabase'
import TestPageWrapper from '../../../../components/TestPageWrapper'

const supabase = getSupabaseClient()

export default function SectionPage() {
  const [loading, setLoading] = useState(true)
  const [showTest, setShowTest] = useState(false)
  const [stats, setStats] = useState(null)
  const [sectionConfig, setSectionConfig] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadSectionData()
  }, [])

  const loadSectionData = async () => {
    try {
      // Cargar configuración de la sección desde law_sections
      const { data: sectionData, error: sectionError } = await supabase
        .from('law_sections')
        .select('*')
        .eq('slug', 'SECTION_SLUG')
        .single()

      if (sectionError || !sectionData) {
        console.error('Error cargando sección:', sectionError)
        setStats({ questionsCount: 0 })
        setLoading(false)
        return
      }

      // Configurar datos de la sección
      const config = {
        title: sectionData.title,
        description: sectionData.description,
        lawId: sectionData.law_id,
        articleRange: sectionData.article_range_start && sectionData.article_range_end 
          ? { start: sectionData.article_range_start, end: sectionData.article_range_end }
          : null,
        slug: sectionData.slug
      }
      setSectionConfig(config)

      // Si no hay rango de artículos, es una sección especial
      if (!config.articleRange) {
        setStats({ questionsCount: 0, articlesCount: 0 })
        setLoading(false)
        return
      }

      // Obtener artículos específicos de esta sección
      const articleNumbers = Array.from(
        { length: config.articleRange.end - config.articleRange.start + 1 }, 
        (_, i) => String(config.articleRange.start + i)
      )
      
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', config.lawId)
        .in('article_number', articleNumbers)

      if (articlesError) {
        console.error('Error cargando artículos:', articlesError)
        setStats({ questionsCount: 0 })
      } else {
        // Contar preguntas de estos artículos
        let totalQuestions = 0
        
        if (articles && articles.length > 0) {
          const { data: questions, error: questionsError } = await supabase
            .from('questions')
            .select('id')
            .in('primary_article_id', articles.map(a => a.id))
            .eq('is_active', true)

          if (!questionsError && questions) {
            totalQuestions = questions.length
          }
        }

        setStats({
          questionsCount: totalQuestions,
          articlesCount: articles?.length || 0
        })
      }
    } catch (error) {
      console.error('Error cargando datos de la sección:', error)
      setStats({ questionsCount: 0 })
    } finally {
      setLoading(false)
    }
  }

  const handleStartTest = () => {
    setShowTest(true)
  }

  if (showTest && sectionConfig) {
    // Configuración del test para esta sección específica
    const testConfig = {
      numQuestions: Math.min(stats?.questionsCount || 10, 20),
      excludeRecent: false,
      recentDays: 30,
      difficultyMode: 'random',
      adaptive: true,
      onlyOfficialQuestions: false,
      selectedLaws: ['Ley 39/2015'],
      selectedArticlesByLaw: sectionConfig.articleRange ? {
        'Ley 39/2015': Array.from(
          { length: sectionConfig.articleRange.end - sectionConfig.articleRange.start + 1 }, 
          (_, i) => String(sectionConfig.articleRange.start + i)
        )
      } : {},
      customNavigationLinks: {
        backToLaw: {
          href: '/test-oposiciones/test-ley-39-2015',
          text: 'Volver a Tests de la Ley 39/2015'
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
        customIcon="📜"
        customColor="from-emerald-500 to-teal-600"
      />
    )
  }

  // Mostrar loading mientras se cargan los datos
  if (loading || !sectionConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de la sección...</p>
        </div>
      </div>
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
            <Link href="/test-oposiciones/test-ley-39-2015" className="hover:text-blue-600">
              Ley 39/2015
            </Link>
            <span className="mx-2">›</span>
            <span className="font-medium text-gray-900">
              {sectionConfig.title}
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">📜</div>
          <h1 className="text-3xl font-bold mb-4">
            {sectionConfig.title}
          </h1>
          <p className="text-emerald-100 text-lg mb-6">
            {sectionConfig.description}
          </p>
          
          {stats && (
            <div className="flex justify-center gap-8 mb-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.questionsCount}</div>
                <div className="text-sm text-emerald-100">Preguntas</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.articlesCount}</div>
                <div className="text-sm text-emerald-100">Artículos</div>
              </div>
              {sectionConfig.articleRange && (
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-2xl font-bold">
                    {sectionConfig.articleRange.end - sectionConfig.articleRange.start + 1}
                  </div>
                  <div className="text-sm text-emerald-100">Artículos Total</div>
                </div>
              )}
            </div>
          )}

          {/* Botón de inicio del test */}
          <div className="text-center">
            {stats && stats.questionsCount > 0 ? (
              <button
                onClick={handleStartTest}
                className="bg-white text-emerald-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg"
              >
                🚀 Empezar Test ({stats.questionsCount} preguntas)
              </button>
            ) : (
              <div className="bg-emerald-100 border border-emerald-400 text-emerald-700 px-4 py-3 rounded">
                ⚠️ No hay preguntas disponibles para esta sección aún.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={\`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-colors duration-200 \${
              activeTab === 'overview'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }\`}
          >
            📊 Información del Test
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={\`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-colors duration-200 \${
              activeTab === 'content'
                ? 'bg-white text-emerald-600 shadow-sm'
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
                    Test especializado en plazos
                  </h4>
                </div>
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">🎯 Tema Principal</h3>
              <div className="text-gray-600 text-sm">
                <div className="flex items-start">
                  <span className="text-emerald-500 mr-2 mt-1">•</span>
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
                    de la Ley 39/2015 del Procedimiento Administrativo Común de las Administraciones Públicas.
                  </p>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">📋 Rango de artículos:</h4>
                    <p className="text-sm text-gray-600">
                      Del artículo <strong>{sectionConfig.articleRange.start}</strong> al artículo <strong>{sectionConfig.articleRange.end}</strong>
                    </p>
                  </div>
                  
                  <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-800">
                      💡 <strong>Consejo:</strong> Utiliza el tab "Información del Test" para realizar tests específicos 
                      de estos artículos y evaluar tu conocimiento.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-yellow-800">
                  <strong>Test especial de plazos</strong> - Este test incluye preguntas transversales 
                  sobre plazos administrativos de toda la Ley 39/2015.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Enlaces relacionados */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4">Tests Relacionados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/test-oposiciones/test-ley-39-2015"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              → Volver a todos los tests de la Ley 39/2015
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
`;

async function updateSection(sectionSlug) {
  try {
    const filePath = join(process.cwd(), 'app', 'test-oposiciones', 'test-ley-39-2015', sectionSlug, 'page.js');
    
    // Crear contenido específico para esta sección
    const content = newPageTemplate.replace(/SECTION_SLUG/g, sectionSlug);
    
    // Escribir el archivo
    await writeFile(filePath, content, 'utf8');
    console.log(`✅ Actualizado: ${sectionSlug}`);
    
  } catch (error) {
    console.error(`❌ Error actualizando ${sectionSlug}:`, error.message);
  }
}

async function updateAllSections() {
  console.log('🔄 Actualizando todas las secciones de la Ley 39/2015...');
  console.log(`📝 ${sections.length} secciones a actualizar`);
  
  for (const section of sections) {
    await updateSection(section);
  }
  
  console.log('✅ Todas las secciones han sido actualizadas');
  console.log('🎯 Próximos pasos:');
  console.log('1. ✅ Verificar que las páginas cargan correctamente');
  console.log('2. ✅ Comprobar que los tests funcionan');
  console.log('3. ✅ Validar la navegación y breadcrumbs');
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  updateAllSections();
}

export { updateAllSections };