// app/test-oposiciones/test-ley-39-2015/titulo-preliminar/page.js
import Link from 'next/link'
import { loadSectionData, generateSectionMetadata } from '../../../../lib/ley39SSR'
import { StartTestButton, TabsSection } from './SectionClientComponents'

// Generar metadata dinámicamente para SEO
export async function generateMetadata() {
  const data = await loadSectionData('titulo-preliminar')
  
  if (!data || !data.config) {
    return {
      title: 'Sección no encontrada - Ley 39/2015',
      description: 'La sección solicitada no fue encontrada.'
    }
  }

  return generateSectionMetadata(data.config)
}

// Pre-renderizar datos en el servidor
export default async function SectionPage() {
  const data = await loadSectionData('titulo-preliminar')
  
  if (!data || !data.config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sección no encontrada</h1>
          <p className="text-gray-600 mb-4">La sección solicitada no existe.</p>
          <Link 
            href="/test-oposiciones/test-ley-39-2015"
            className="text-blue-600 hover:text-blue-800"
          >
            Volver a Tests de la Ley 39/2015
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

          {/* Botón de inicio del test */}
          <div className="text-center">
            {stats.questionsCount > 0 ? (
              <StartTestButton 
                sectionConfig={sectionConfig}
                questionsCount={stats.questionsCount}
              />
            ) : (
              <div className="bg-emerald-100 border border-emerald-400 text-emerald-700 px-4 py-3 rounded">
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