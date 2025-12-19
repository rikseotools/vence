import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/verify-articles/stats-by-law
 * Devuelve estadísticas de artículos por ley
 */
export async function GET() {
  try {
    console.log('📊 [STATS-BY-LAW] Cargando stats de verificación...')
    // Obtener todas las leyes con su estado de verificación y resumen
    const { data: laws, error: lawsError } = await supabase
      .from('laws')
      .select('id, short_name, last_checked, verification_status, last_verification_summary')

    if (lawsError) {
      console.error('❌ [STATS-BY-LAW] Error:', lawsError)
      throw lawsError
    }

    console.log('📊 [STATS-BY-LAW] Leyes cargadas:', laws?.length)

    const statsByLaw = {}

    for (const law of laws || []) {
      const summary = law.last_verification_summary || null
      statsByLaw[law.id] = {
        lastVerified: law.last_checked,
        status: law.verification_status,
        isOk: summary?.is_ok || false, // Usar is_ok del summary
        summary: summary
      }
      // Log solo si tiene summary
      if (summary) {
        console.log('📊 [STATS-BY-LAW] Ley con summary:', law.short_name, summary)
      }
    }

    return Response.json({
      success: true,
      stats: statsByLaw
    })

  } catch (error) {
    console.error('Error obteniendo stats por ley:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
