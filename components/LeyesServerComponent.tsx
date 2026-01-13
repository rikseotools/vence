// components/LeyesServerComponent.tsx - COMPONENTE SERVIDOR
// Obtiene datos del servidor y los pasa al wrapper cliente para filtrado interactivo
import { getLawsWithQuestionCounts } from '@/lib/api/laws'
import type { LawWithCounts } from '@/lib/api/laws'
import LeyesClientWrapper from './LeyesClientWrapper'

export default async function LeyesServerComponent() {
  try {
    // Query Drizzle con cache interno (5 minutos)
    const result = await getLawsWithQuestionCounts()

    if (!result.success || !result.laws || result.laws.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            No hay leyes disponibles
          </h3>
          <p className="text-gray-600">
            {result.error || 'No se encontraron leyes con preguntas en la base de datos.'}
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
