// app/api/admin/newsletters/audience/route.ts - Estadísticas de audiencia para newsletters
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAudienceStats,
  getUnsubscribedCount,
  oposicionDisplayNames
} from '@/lib/api/newsletters'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function _GET() {
  try {
    console.log('📊 [Newsletter/Audience] Obteniendo estadísticas de audiencia...')

    // Obtener estadísticas usando Drizzle (respeta unsubscribedAll)
    const audienceStats = await getAudienceStats()

    // Obtener conteo de usuarios dados de baja
    const unsubscribedCount = await getUnsubscribedCount()

    console.log('📊 [Newsletter/Audience] Estadísticas calculadas:', {
      general: audienceStats.general,
      oposiciones: audienceStats.byOposicion.map(o => `${o.key}: ${o.count}`),
      unsubscribed: unsubscribedCount
    })

    return NextResponse.json({
      success: true,
      audienceStats: {
        ...audienceStats.general,
        // Añadir estadísticas por oposición al response para compatibilidad
        byOposicion: audienceStats.byOposicion
      },
      unsubscribedCount,
      // Metadata adicional
      meta: {
        note: 'Todos los conteos excluyen usuarios con unsubscribedAll=true',
        oposicionTypes: Object.entries(oposicionDisplayNames).map(([key, name]) => ({
          key,
          name
        }))
      }
    })

  } catch (error) {
    console.error('❌ [Newsletter/Audience] Error obteniendo estadísticas:', error)
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo estadísticas',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/admin/newsletters/audience', _GET)
