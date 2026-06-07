// app/test-oposiciones/test-ley-39-2015/page.js
import Link from 'next/link'
import { loadLey39Data } from '../../../lib/ley39SSR'
export const dynamic = 'force-dynamic'


// Pre-renderizar datos en el servidor
export default async function TestLey392015Page() {
  const { sections, stats } = await loadLey39Data()

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
              Tests Ley 39/2015
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-7xl mb-6">📋</div>
          <h1 className="text-4xl font-bold mb-4">
            Tests Ley 39/2015 - LPAC
          </h1>
          <p className="text-emerald-100 text-xl mb-8 max-w-3xl mx-auto">
            Procedimiento Administrativo Común - Para oposiciones de Auxiliar Administrativo, AGE, Técnico Gestión, Administración Local, Justicia y Educación
          </p>
          
          <div className="flex justify-center gap-8 mb-8">
            <div className="bg-white/10 rounded-lg p-6">
              <div className="text-3xl font-bold">{stats.totalSections}</div>
              <div className="text-sm text-emerald-100">Secciones</div>
            </div>
            <div className="bg-white/10 rounded-lg p-6">
              <div className="text-3xl font-bold">{stats.totalQuestions}</div>
              <div className="text-sm text-emerald-100">Preguntas</div>
            </div>
            <div className="bg-white/10 rounded-lg p-6">
              <div className="text-3xl font-bold">{stats.totalArticles}</div>
              <div className="text-sm text-emerald-100">Artículos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* CTA principal: test completo de la ley (configurador canónico) */}
        <div className="mb-10 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 md:p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            ¿Quieres un test completo de la Ley 39/2015?
          </h2>
          <p className="text-gray-600 mb-6">
            Configura número de preguntas, dificultad y filtra por títulos o artículos concretos.
          </p>
          <Link
            href="/leyes/ley-39-2015"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            <span>🎯</span>
            <span>Iniciar test de Ley 39/2015</span>
          </Link>
          <p className="text-xs text-gray-500 mt-4">
            O selecciona abajo un título o sección específica para practicar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/test-oposiciones/test-ley-39-2015/${section.slug}`}
              className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-emerald-300"
            >
              <div className="p-6">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {section.image}
                </div>
                <h3 className="font-bold text-gray-900 mb-3 group-hover:text-emerald-600 transition-colors">
                  {section.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {section.description}
                </p>
                {section.articles && (
                  <div className="text-xs text-emerald-600 font-medium">
                    Artículos {section.articles.start}-{section.articles.end}
                  </div>
                )}
                {section.slug === 'test-plazos' && (
                  <div className="text-xs text-emerald-600 font-medium">
                    Test especializado en plazos
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Información adicional */}
        <div className="mt-16 bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Sobre la Ley 39/2015
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">📋 Estructura</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• Título Preliminar: Disposiciones generales</li>
                <li>• Título I: De los interesados en el procedimiento</li>
                <li>• Título II: De la actividad de las Administraciones Públicas</li>
                <li>• Título III: De los actos administrativos</li>
                <li>• Título IV: Del procedimiento administrativo común</li>
                <li>• Título V: De la revisión de los actos en vía administrativa</li>
                <li>• Título VI: De la iniciativa legislativa y la potestad reglamentaria</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">🎯 Oposiciones que incluyen esta Ley</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• <strong>Auxiliar Administrativo del Estado</strong> - Tema fundamental</li>
                <li>• <strong>Técnico de Gestión</strong> - Procedimiento administrativo</li>
                <li>• <strong>Administrativo del Estado (AGE)</strong> - Temario básico</li>
                <li>• <strong>Administración Local</strong> - Ayuntamientos y Diputaciones</li>
                <li>• <strong>Administración de Justicia</strong> - Tramitación procesal</li>
                <li>• <strong>Educación</strong> - Centros educativos públicos</li>
                <li>• <strong>Sanidad</strong> - Administración sanitaria</li>
                <li>• <strong>Seguridad Social</strong> - INSS, TGSS</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}