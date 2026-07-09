// app/api/admin/revalidate-temario/route.ts
// Invalida la cache del temario. Solo se dispara manualmente: POST sin body.
//
// Los triggers PG sobre topics/topic_scope/oposicion_bloques/oposiciones
// fueron eliminados el 16/04/2026 (migración 20260416_drop_revalidate_triggers.sql)
// porque generaban ~5M ISR Writes/mes (~$20 facturados por el hosting/CDN).
// El cron check-seguimiento por sí solo disparaba 41 invalidaciones/día sin
// que cambiara nada visible para el usuario. Mismo patrón ya aplicado a
// feedback (commit 166c1ddf) y disputes (commit 3774509e).
//
// Tras cambios manuales en BD, invocar: curl -X POST https://www.vence.es/api/admin/revalidate-temario
// Ver docs/maintenance/cache-revalidation.md.
//
// AGNÓSTICO (05/07): eliminada la verificación SUPABASE_WEBHOOK_SECRET. Los
// triggers PG que invocaban este endpoint como webhook de Supabase se quitaron
// el 16/04/2026, así que la rama de secret estaba muerta. Queda como disparador
// de revalidación manual (mismo comportamiento que ya tenía el path sin body).

import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { refreshTeoriaCatalog } from '@/lib/api/laws/teoriaCatalog'

async function _POST() {
  // Next.js 16 requiere segundo argumento con el profile de cacheLife
  revalidateTag('temario', 'max')

  // También revalidar landings (oposiciones usan datos de BD)
  revalidateTag('landing', 'max')

  // Leyes (getLawsWithQuestionCounts, 30 días de caché)
  revalidateTag('laws', 'max')

  // Catálogo de teoría (/teoria): totales cacheados (tag 'teoria').
  revalidateTag('teoria', 'max')

  // Refrescar la matview del catálogo de teoría (SSOT del listado + buscador).
  // Best-effort: un fallo aquí (p.ej. matview aún no migrada) NO debe abortar
  // la revalidación de cache, que es lo principal de este endpoint.
  let teoriaCatalogRefreshed = true
  try {
    await refreshTeoriaCatalog()
  } catch (err) {
    teoriaCatalogRefreshed = false
    console.error('⚠️ refreshTeoriaCatalog falló (no bloqueante):', (err as Error).message)
  }

  return NextResponse.json({
    success: true,
    message: 'Cache temario + landing + laws + teoria invalidada.',
    teoriaCatalogRefreshed,
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/admin/revalidate-temario', _POST)
