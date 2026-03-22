// app/api/cron/check-seguimiento/route.ts
// Cron diario: verifica cambios en páginas de seguimiento de convocatorias

import { NextRequest, NextResponse } from 'next/server'
import {
  getOposicionesForSeguimientoCheck,
  checkSeguimientoUrl,
  saveSeguimientoCheck,
  type CheckResult,
  type SeguimientoCheckStats,
} from '@/lib/api/seguimiento-convocatorias/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutos

interface CheckSeguimientoResponse {
  success: boolean
  duration: string
  stats: SeguimientoCheckStats
  changes: Array<{ nombre: string; slug: string | null }>
  errors: Array<{ nombre: string; error: string }>
  timestamp: string
  error?: string
}

async function _GET(request: NextRequest): Promise<NextResponse<CheckSeguimientoResponse>> {
  // Auth
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', duration: '0s', stats: { total: 0, checked: 0, changed: 0, errors: 0, unchanged: 0 }, changes: [], errors: [], timestamp: new Date().toISOString() },
      { status: 401 }
    )
  }

  const startTime = Date.now()

  try {
    console.log('🔍 [Seguimiento] Iniciando verificación de páginas de seguimiento...')

    const oposiciones = await getOposicionesForSeguimientoCheck()
    console.log(`📋 [Seguimiento] ${oposiciones.length} oposiciones con seguimiento_url`)

    if (!oposiciones.length) {
      return NextResponse.json({
        success: true,
        duration: '0s',
        stats: { total: 0, checked: 0, changed: 0, errors: 0, unchanged: 0 },
        changes: [],
        errors: [],
        timestamp: new Date().toISOString(),
      })
    }

    const results: CheckResult[] = []
    const changes: Array<{ nombre: string; slug: string | null }> = []
    const errors: Array<{ nombre: string; error: string }> = []

    // Verificar secuencialmente (no saturar servidores externos)
    for (const opo of oposiciones) {
      console.log(`  🔎 Verificando: ${opo.shortName ?? opo.nombre}`)
      const result = await checkSeguimientoUrl(opo)
      results.push(result)

      if (result.error) {
        console.log(`  ❌ Error: ${result.error}`)
        errors.push({ nombre: opo.nombre, error: result.error })
      } else if (result.hasChanged) {
        console.log(`  🔔 CAMBIO DETECTADO: ${opo.shortName ?? opo.nombre}`)
        changes.push({ nombre: opo.nombre, slug: opo.slug })
      } else {
        console.log(`  ✅ Sin cambios`)
      }

      // Guardar resultado
      await saveSeguimientoCheck(result)

      // Pausa entre requests para no saturar
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    const stats: SeguimientoCheckStats = {
      total: oposiciones.length,
      checked: results.length,
      changed: changes.length,
      errors: errors.length,
      unchanged: results.length - changes.length - errors.length,
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    console.log(`\n📊 [Seguimiento] Completado en ${duration}:`, stats)

    if (changes.length > 0) {
      console.log(`🔔 [Seguimiento] ${changes.length} cambios detectados:`, changes.map(c => c.nombre).join(', '))
    }

    return NextResponse.json({
      success: true,
      duration,
      stats,
      changes,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    console.error('❌ [Seguimiento] Error:', (error as Error).message)
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        duration,
        stats: { total: 0, checked: 0, changed: 0, errors: 0, unchanged: 0 },
        changes: [],
        errors: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/cron/check-seguimiento', _GET)
