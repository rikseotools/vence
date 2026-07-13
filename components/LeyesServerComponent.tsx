// components/LeyesServerComponent.tsx - COMPONENTE SERVIDOR
// Obtiene datos del servidor y los pasa al wrapper cliente para filtrado interactivo
import Link from 'next/link'
import { getLawsWithQuestionCounts } from '@/lib/api/laws'
import type { LawWithCounts } from '@/lib/api/laws'
import LeyesClientWrapper from './LeyesClientWrapper'

export default async function LeyesServerComponent() {
  try {
    // Query Drizzle con cache interno (5 minutos)
    const result = await getLawsWithQuestionCounts()

    // ERROR de carga (timeout/BD) — NO es "no hay leyes". Antes se mostraba el
    // mismo dead-end "No hay leyes disponibles" (bug Alfonso 13/07: la query se
    // pasaba de timeout bajo carga → parecía que no había contenido). Ahora es un
    // estado de reintento explícito y distinto del vacío real.
    if (!result.success) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⏳</div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            Estamos cargando las leyes
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Está tardando un poco más de lo normal. Recarga la página en unos segundos.
          </p>
          <Link
            href="/leyes"
            className="inline-block px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            Reintentar
          </Link>
        </div>
      )
    }

    // Vacío GENUINO (0 leyes con preguntas) — muy raro.
    if (!result.laws || result.laws.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            No hay leyes disponibles
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {'No se encontraron leyes con preguntas. Inténtalo de nuevo en unos minutos.'}
          </p>
        </div>
      )
    }

    // Pasar las leyes al componente cliente para filtrado interactivo
    // El HTML inicial contiene TODAS las leyes (SEO), el cliente añade interactividad
    return <LeyesClientWrapper laws={result.laws} />

  } catch (error) {
    console.error('❌ Error en LeyesServerComponent:', error)

    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-gray-800 mb-3">
          Error cargando leyes
        </h3>
        <p className="text-gray-600 mb-6">
          Hubo un problema al cargar las leyes desde la base de datos.
        </p>
      </div>
    )
  }
}
