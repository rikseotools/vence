import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Recalcula isOk en tiempo real basándose en el summary
 * Criterios: Sin ninguna discrepancia (título, contenido, extras o faltantes)
 * NOTA: Los artículos de estructura (art. 0, índice) no se cuentan como "extra"
 */
function calculateIsOk(summary) {
  if (!summary) return false
  // Si es ley sin texto consolidado (doc.php), se considera OK
  if (summary.no_consolidated_text) return true

  // Si no se encontraron artículos en BOE (URL incorrecta o problema de sync), NO está OK
  // Soporta formato nuevo (boe_count) y antiguo (total_boe)
  const boeCount = summary.boe_count ?? summary.total_boe ?? null
  if (boeCount === 0) return false

  // Si el mensaje indica que no se encontraron artículos, NO está OK
  if (summary.message && summary.message.includes('No se encontraron artículos')) return false

  // Artículos de estructura (art. 0, índice, etc.) son intencionales
  // No se cuentan como "extra_in_db" para el cálculo de isOk
  const structureArticles = summary.structure_articles || 0
  const realExtraInDb = Math.max(0, (summary.extra_in_db || 0) - structureArticles)

  return (
    (summary.title_mismatch || 0) === 0 &&
    (summary.content_mismatch || 0) === 0 &&
    realExtraInDb === 0 &&
    (summary.missing_in_db || 0) === 0
  )
}

/**
 * GET /api/verify-articles/stats-by-law
 * Devuelve estadísticas de artículos por ley
 */
export async function GET() {
  try {
    // Obtener todas las leyes con su estado de verificación y resumen
    const { data: laws, error: lawsError } = await getSupabase()
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
