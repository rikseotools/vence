// app/api/cron/check-seguimiento/route.ts
// Cron diario: verifica cambios en páginas de seguimiento de convocatorias.
//
// Arquitectura (refactor 2026-05-07): paralelización con throttle por dominio.
// - Antes: bucle secuencial 42 ops × (3-5s fetch + 2s pausa) → ~210-294s, no
//   cabía en maxDuration=120s, Vercel killing → workflow GH Actions failures.
// - Ahora: agrupamos por dominio, procesamos dominios en paralelo (concurrency=5)
//   pero dentro de cada dominio secuencial con pausa 1s. Así no martillamos
//   un mismo servidor pero ganamos paralelismo entre dominios distintos.

import { NextRequest, NextResponse } from 'next/server'
import {
  getOposicionesForSeguimientoCheck,
  checkSeguimientoUrl,
  saveSeguimientoCheck,
  type CheckResult,
  type SeguimientoCheckStats,
  type OposicionToCheck,
} from '@/lib/api/seguimiento-convocatorias/queries'
import { groupByDomain, runWithConcurrency } from '@/lib/api/seguimiento-convocatorias/concurrency'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
// 300s = 5 min. Para 42 ops con paralelización 5×, el peor caso (todas del
// mismo dominio) tarda ~210s; con dominios distribuidos, ~50-80s.
export const maxDuration = 300

const CONCURRENCY = 5
const DELAY_PER_DOMAIN_MS = 1000 // pausa entre requests al mismo servidor

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

    // Agrupar por dominio para no martillear el mismo servidor.
    // Procesamos dominios en paralelo (concurrency=5), pero dentro de un
    // dominio secuencial con pausa 1s. Así un dominio con 10 oposiciones
    // (ej. junta CCAA con varios procesos) no recibe rafagas.
    const domainGroups = groupByDomain(oposiciones, (opo) => opo.seguimientoUrl)
    console.log(`🌐 [Seguimiento] ${domainGroups.length} dominios distintos, concurrency=${CONCURRENCY}`)

    // Mutex para appends concurrentes a results/changes/errors
    const pushResult = (result: CheckResult, opo: OposicionToCheck) => {
      results.push(result)
      if (result.error) {
        errors.push({ nombre: opo.nombre, error: result.error })
      } else if (result.hasChanged) {
        changes.push({ nombre: opo.nombre, slug: opo.slug })
      }
    }

    await runWithConcurrency(domainGroups, CONCURRENCY, async (group) => {
      for (let i = 0; i < group.length; i++) {
        const opo = group[i]
        console.log(`  🔎 Verificando: ${opo.shortName ?? opo.nombre}`)
        const result = await checkSeguimientoUrl(opo)
        pushResult(result, opo)

        if (result.error) {
          console.log(`  ❌ Error ${opo.shortName ?? opo.nombre}: ${result.error}`)
        } else if (result.hasChanged) {
          console.log(`  🔔 CAMBIO DETECTADO: ${opo.shortName ?? opo.nombre}`)
        } else {
          console.log(`  ✅ Sin cambios: ${opo.shortName ?? opo.nombre}`)
        }

        // Guardar resultado (no abortar el cron si falla un save individual)
        try {
          await saveSeguimientoCheck(result)
        } catch (saveErr) {
          console.error(`  ⚠️ Error guardando check de ${opo.nombre}:`, (saveErr as Error).message)
        }

        // Pausa entre requests al MISMO dominio (no saturar). Skip en último item.
        if (i < group.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_PER_DOMAIN_MS))
        }
      }
    })

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
