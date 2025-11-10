// app/test-oposiciones/procedimiento-administrativo/page.js
import Link from 'next/link'
import { loadProcedimientoAdministrativoData } from '../../../lib/procedimientoAdministrativoSSR'

export default async function ProcedimientoAdministrativoPage() {
  const { sections, stats } = await loadProcedimientoAdministrativoData()

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
              Procedimiento Administrativo
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-7xl mb-6">📋</div>
          <h1 className="text-4xl font-bold mb-4">
            Tests Procedimiento Administrativo
          </h1>
          <p className="text-emerald-100 text-xl mb-8 max-w-3xl mx-auto">
            Contenido organizado por materias del procedimiento administrativo común. Conceptos generales, actos administrativos, recursos y jurisdicción contencioso-administrativa
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
            <div className="bg-white/10 rounded-lg p-6">
              <div className="text-3xl font-bold">{stats.lawsUsed?.length || 0}</div>
              <div className="text-sm text-emerald-100">Leyes</div>
            </div>
          </div>
          
          {/* Nueva sección: Leyes utilizadas */}
          {stats.lawsUsed && stats.lawsUsed.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-emerald-100 mb-4 text-center">
                📚 Leyes incluidas en este contenido
              </h2>
              <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
                {stats.lawsUsed.map((law, index) => (
                  <div 
                    key={law.short_name}
                    className="bg-white/15 text-emerald-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors border border-emerald-300/20"
                  >
                    <span className="font-bold">{law.short_name}</span>
                    {law.name && (
                      <div className="text-xs text-emerald-200 mt-1 leading-tight">
                        {law.name.length > 60 ? law.name.substring(0, 60) + '...' : law.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/test-oposiciones/procedimiento-administrativo/${section.slug}`}
              className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-emerald-300"
            >
              <div className="p-6">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {section.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-3 group-hover:text-emerald-600 transition-colors">
                  {section.name}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {section.description}
                </p>
                <div className="text-xs text-emerald-600 font-medium">
                  Sección {section.section_number}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Información adicional */}
        <div className="mt-16 bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Sobre el Procedimiento Administrativo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">📋 Contenido</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• Conceptos generales y principios básicos</li>
                <li>• Procedimiento administrativo común y sus fases</li>
                <li>• Responsabilidad patrimonial de las Administraciones</li>
                <li>• Términos y plazos administrativos</li>
                <li>• Actos administrativos: elementos y requisitos</li>
                <li>• Eficacia, validez, nulidad y anulabilidad</li>
                <li>• Ejecución de actos administrativos y procedimientos ejecutivos</li>
                <li>• Revisión de oficio y recursos administrativos</li>
                <li>• Jurisdicción contencioso-administrativa</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">🎯 Aplicaciones</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• <strong>Oposiciones Auxiliar Administrativo</strong> - Materia fundamental</li>
                <li>• <strong>Técnico de Gestión</strong> - Procedimiento administrativo</li>
                <li>• <strong>Administrativo del Estado (AGE)</strong> - Temario básico</li>
                <li>• <strong>Administración Local</strong> - Ayuntamientos y Diputaciones</li>
                <li>• <strong>Administración de Justicia</strong> - Tramitación procesal</li>
                <li>• <strong>Educación</strong> - Centros educativos públicos</li>
                <li>• <strong>Sanidad</strong> - Administración sanitaria</li>
                <li>• <strong>Formación especializada</strong> - Derecho Administrativo</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'Tests Procedimiento Administrativo - Oposiciones | Vence',
    description: 'Tests de procedimiento administrativo organizados por materias. Conceptos generales, actos administrativos, recursos y jurisdicción contencioso-administrativa. Para oposiciones de Auxiliar Administrativo, AGE, Técnico Gestión y más.',
    keywords: 'test procedimiento administrativo, actos administrativos, recursos administrativos, jurisdicción contencioso administrativa, oposiciones auxiliar administrativo, procedimiento administrativo común',
    openGraph: {
      title: 'Tests Procedimiento Administrativo - Oposiciones',
      description: 'Tests especializados de procedimiento administrativo organizados por materias. Para oposiciones de Auxiliar Administrativo, AGE y más.',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Tests Procedimiento Administrativo | Oposiciones',
      description: 'Tests de procedimiento administrativo por materias. Oposiciones Auxiliar Administrativo, AGE.',
    },
  }
}