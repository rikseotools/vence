// app/test-oposiciones/test-de-la-constitucion-espanola-de-1978/page.js
import Link from 'next/link'
import { loadConstitucionData } from '../../../lib/constitucionSSR'

// Pre-renderizar datos en el servidor
export default async function TestConstitucionPage() {
  const { sections, stats } = await loadConstitucionData()

  return (
    <div className="bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex text-sm text-gray-600">
            <Link href="/test-oposiciones" className="hover:text-blue-600">
              Tests de Oposiciones
            </Link>
            <span className="mx-2">›</span>
            <span className="font-medium text-gray-900">
              Tests Constitución Española 1978
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-10 md:py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-5xl md:text-7xl mb-4 md:mb-6">🏛️</div>
          <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">
            Tests Constitución Española 1978
          </h1>
          <p className="text-blue-100 text-base md:text-xl mb-6 md:mb-8 max-w-3xl mx-auto">
            Preparación especializada para oposiciones: Auxiliar Administrativo, AGE, Justicia, Correos, Sanidad y más
          </p>
          
          <div className="flex justify-center gap-4 md:gap-8 mb-6 md:mb-8">
            <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
              <div className="text-xl md:text-3xl font-bold">{stats.totalSections}</div>
              <div className="text-xs md:text-sm text-blue-100">Secciones</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
              <div className="text-xl md:text-3xl font-bold">{stats.totalQuestions}</div>
              <div className="text-xs md:text-sm text-blue-100">Preguntas</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
              <div className="text-xl md:text-3xl font-bold">{stats.totalArticles}</div>
              <div className="text-xs md:text-sm text-blue-100">Artículos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/test-oposiciones/test-de-la-constitucion-espanola-de-1978/${section.slug}`}
              className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-blue-300"
            >
              <div className="p-6">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {section.image}
                </div>
                <h3 className="font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {section.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {section.description}
                </p>
                {section.articles && (
                  <div className="text-xs text-blue-600 font-medium">
                    Artículos {section.articles.start}-{section.articles.end}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Información adicional */}
        <div className="mt-16 bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Sobre la Constitución Española de 1978
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">🏛️ Estructura</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• Preámbulo y Título Preliminar: Fundamentos del Estado</li>
                <li>• Título I: Derechos y deberes fundamentales</li>
                <li>• Título II: La Corona</li>
                <li>• Título III: Las Cortes Generales</li>
                <li>• Título IV: Gobierno y Administración</li>
                <li>• Título V: Relaciones Gobierno-Cortes</li>
                <li>• Título VI: Poder Judicial</li>
                <li>• Título VII: Economía y Hacienda</li>
                <li>• Título VIII: Organización territorial</li>
                <li>• Título IX: Tribunal Constitucional</li>
                <li>• Título X: Reforma constitucional</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">🎯 Oposiciones que incluyen la Constitución</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• <strong>Auxiliar Administrativo del Estado</strong> - Tema fundamental</li>
                <li>• <strong>Administrativo del Estado (AGE)</strong> - Temario básico</li>
                <li>• <strong>Administración de Justicia</strong> - Organización del Estado</li>
                <li>• <strong>Correos y Telégrafos</strong> - Derecho constitucional</li>
                <li>• <strong>Sanidad</strong> - Administración pública</li>
                <li>• <strong>Administración Local</strong> - Organización territorial</li>
                <li>• <strong>Educación</strong> - Derechos fundamentales</li>
                <li>• <strong>Seguridad Social</strong> - Principios constitucionales</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}