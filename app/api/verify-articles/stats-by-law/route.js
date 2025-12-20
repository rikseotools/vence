import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Recalcula isOk en tiempo real basándose en el summary
 * Criterios: Sin discrepancias de título o contenido en artículos existentes
 * (Los artículos faltantes se muestran como info, no como alarma)
 */
function calculateIsOk(summary) {
  if (!summary) return false
  return (
    (summary.title_mismatch || 0) === 0 &&
    (summary.content_mismatch || 0) === 0
  )
}

/**
 * GET /api/verify-articles/stats-by-law
 * Devuelve estadísticas de artículos por ley
 */
export async function GET() {
  try {
    // Obtener todas las leyes con su estado de verificación y resumen
    const { data: laws, error: lawsError } = await supabase
      .from('laws')
      .select('id, short_name, last_checked, verification_status, last_verification_summary')

    if (lawsError) {
      console.error('❌ [STATS-BY-LAW] Error:', lawsError)
      throw lawsError
    }

    const statsByLaw = {}
    let hasDiscrepancies = false

    for (const law of laws || []) {
      const summary = law.last_verification_summary || null
      // Recalcular isOk en tiempo real (no confiar en valor guardado antiguo)
      const isOk = calculateIsOk(summary)

      // Si hay verificación y no está OK, hay discrepancias
      if (summary && !isOk) {
        hasDiscrepancies = true
      }

      statsByLaw[law.id] = {
        lastVerified: law.last_checked,
        status: law.verification_status,
        isOk,
        summary: summary
      }
    }

    return Response.json({
      success: true,
      stats: statsByLaw,
      hasDiscrepancies
    })

  } catch (error) {
    console.error('Error obteniendo stats por ley:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
