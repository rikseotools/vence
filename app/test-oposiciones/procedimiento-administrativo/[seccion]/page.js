// app/test-oposiciones/procedimiento-administrativo/[seccion]/page.js
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { loadProcedimientoSectionData } from '../../../../lib/procedimientoAdministrativoSSR'
import { isValidSection } from '../../../../lib/procedimientoAdministrativoMapping'

export default async function ProcedimientoSeccionPage({ params }) {
  const { seccion } = await params
  
  // Verificar que la sección es válida usando el mapeo
  if (!isValidSection(seccion)) {
    notFound()
  }

  // Cargar datos reales de la sección
  const sectionData = await loadProcedimientoSectionData(seccion)
  
  if (!sectionData) {
    notFound()
  }

  const { config, stats } = sectionData

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex text-sm text-gray-600">
            <Link href="/test-oposiciones" className="hover:text-blue-600">
              Tests de Oposiciones
            </Link>
            <span className="mx-2">›</span>
            <Link href="/test-oposiciones/procedimiento-administrativo" className="hover:text-blue-600">
              Procedimiento Administrativo
            </Link>
            <span className="mx-2">›</span>
            <span className="font-medium text-gray-900">
              {config.name}
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-7xl mb-6">{config.icon}</div>
          <h1 className="text-4xl font-bold mb-4">
            {config.name}
          </h1>
          <p className="text-emerald-100 text-xl mb-8 max-w-3xl mx-auto">
            {config.description}
          </p>
          
          {config.hasMapping && (
            <div className="flex justify-center gap-8 mb-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.articlesCount}</div>
                <div className="text-sm text-emerald-100">Artículos</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.lawsCount}</div>
                <div className="text-sm text-emerald-100">Leyes</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">{stats.questionsCount}</div>
                <div className="text-sm text-emerald-100">Preguntas</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {stats.questionsCount > 0 ? (
          // Mostrar contenido funcional si hay preguntas
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Test Disponible
            </h2>
            <p className="text-gray-600 mb-8">
              Esta sección tiene {stats.questionsCount} preguntas disponibles basadas en {stats.articlesCount} artículos de {stats.lawsCount} leyes.
            </p>
            
            <div className="flex justify-center gap-4 mb-8">
              <Link 
                href={`/test-personalizado?seccion=${seccion}`}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Iniciar Test
              </Link>
              <Link 
                href="/test-oposiciones/procedimiento-administrativo"
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Volver
              </Link>
            </div>
          </div>
        ) : (
          // Mostrar contenido en desarrollo si no hay preguntas
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-6xl mb-6">🚧</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Contenido en Desarrollo
            </h2>
            <p className="text-gray-600 mb-8">
              Esta sección está siendo preparada con preguntas específicas sobre <strong>{config.name.toLowerCase()}</strong>.
              Las preguntas estarán disponibles próximamente.
            </p>
            
            <div className="flex justify-center gap-4">
              <Link 
                href="/test-oposiciones/procedimiento-administrativo"
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Volver a Procedimiento Administrativo
              </Link>
              <Link 
                href="/test-oposiciones"
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Ver Otros Tests
              </Link>
            </div>
          </div>
        )}

        {/* Información detallada sobre la sección */}
        {config.hasMapping && config.mapping && (
          <div className="mt-8 bg-white rounded-xl shadow-md p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Contenido de la Sección
            </h3>
            <p className="text-gray-600 mb-6">
              {config.description}
            </p>
            
            {/* Mostrar leyes y artículos mapeados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(config.mapping.laws).map(([lawShortName, lawData]) => (
                <div key={lawShortName} className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{lawShortName}</h4>
                  <p className="text-sm text-gray-600 mb-3">{lawData.description}</p>
                  <div className="text-xs text-gray-500">
                    <strong>Artículos:</strong> {lawData.articles.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Información general */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Sobre esta sección
          </h3>
          <p className="text-gray-600 mb-4">
            La sección "{config.name}" forma parte del material de estudio de Procedimiento Administrativo.
            Incluye conceptos fundamentales y preguntas específicas para la preparación de oposiciones.
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-emerald-600 text-lg mr-3">ℹ️</div>
              <div>
                <p className="text-emerald-800 text-sm font-medium">
                  Esta sección está mapeada a artículos específicos de las leyes para garantizar contenido preciso y relevante
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }) {
  const { seccion } = await params
  
  if (!isValidSection(seccion)) {
    return {
      title: 'Sección no encontrada | Vence',
      description: 'La sección solicitada no existe.'
    }
  }

  const sectionData = await loadProcedimientoSectionData(seccion)
  
  if (!sectionData) {
    return {
      title: 'Error cargando sección | Vence',
      description: 'No se pudo cargar la información de la sección.'
    }
  }

  const { config, stats } = sectionData
  const statusText = stats.questionsCount > 0 ? `${stats.questionsCount} preguntas disponibles` : 'En desarrollo'
  
  return {
    title: `Test ${config.name} - Procedimiento Administrativo | Vence`,
    description: `${config.description} ${statusText}. Para oposiciones de Auxiliar Administrativo, AGE, Técnico Gestión y más.`,
    keywords: `test procedimiento administrativo, ${seccion}, ${config.name.toLowerCase()}, oposiciones auxiliar administrativo, actos administrativos, recursos administrativos`
  }
}

// ISR on-demand: estas páginas se nutren de la BD (a través del pooler). NO se
// pre-renderizan en build-time para que el build no dependa de la latencia/zombis
// del pooler (Supavisor) — ese acoplamiento hacía abortar el build por timeout SSG.
// Con generateStaticParams vacío + dynamicParams (true por defecto), cada sección
// válida se genera server-side en su primera petición y se cachea/revalida (ISR);
// las secciones no válidas se filtran con isValidSection() → notFound().
export const revalidate = 86400 // 24h

export function generateStaticParams() {
  return []
}