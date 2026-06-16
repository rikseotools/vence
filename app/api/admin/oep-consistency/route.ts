// app/api/admin/oep-consistency/route.ts
// Indicador de COHERENCIA OEP para /admin/salud-sistema.
//
// Vigila incoherencias en los datos de convocatorias que antes solo se
// detectaban por casualidad (revisión manual del 16/06/2026):
//   1) Estados stale: estado_proceso 'inscripcion_abierta'/'convocada' con el
//      plazo de inscripción YA vencido (el cron advance-estado debería avanzarlos;
//      si aparecen, algo no corre).
//   2) Señales OEP pending añejas: oep_detection_signals status='pending' con
//      más de 7 días sin revisar (cola de triaje estancada).
//   3) Oposiciones ACTIVAS (landing pública) sin ningún hito (timeline vacío).
//
// Read-only. Aislado del route crítico system-health a propósito.
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/db/client'
import { oposiciones, oepDetectionSignals } from '@/db/schema'
import { and, eq, lt, inArray, sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]
function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

type Status = 'green' | 'amber' | 'red'
const worst = (a: Status, b: Status): Status =>
  a === 'red' || b === 'red' ? 'red' : a === 'amber' || b === 'amber' ? 'amber' : 'green'

const PENDING_STALE_DAYS = 7

async function _GET(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/admin/oep-consistency')
  if (!auth.success) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!isAdmin(auth.email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const db = getAdminDb()
  const today = new Date().toISOString().slice(0, 10)
  const pendingThreshold = new Date(Date.now() - PENDING_STALE_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10)

  // 1) Estados stale (plazo vencido pero estado sin avanzar)
  const staleRows = await db
    .select({ slug: oposiciones.slug, estado: oposiciones.estadoProceso, deadline: oposiciones.inscriptionDeadline })
    .from(oposiciones)
    .where(
      and(
        inArray(oposiciones.estadoProceso, ['inscripcion_abierta', 'convocada']),
        lt(oposiciones.inscriptionDeadline, today),
      ),
    )

  // 2) Señales pending añejas (>7d sin revisar)
  const agedRows = await db
    .select({ id: oepDetectionSignals.id, createdAt: oepDetectionSignals.createdAt })
    .from(oepDetectionSignals)
    .where(and(eq(oepDetectionSignals.status, 'pending'), lt(oepDetectionSignals.createdAt, pendingThreshold)))

  // 3) Oposiciones activas sin ningún hito
  const noHitosRows = await db
    .select({ slug: oposiciones.slug })
    .from(oposiciones)
    .where(
      and(
        eq(oposiciones.isActive, true),
        sql`NOT EXISTS (SELECT 1 FROM convocatoria_hitos h WHERE h.oposicion_id = ${oposiciones.id})`,
      ),
    )

  const staleCount = staleRows.length
  const agedCount = agedRows.length
  const noHitosCount = noHitosRows.length

  const staleStatus: Status = staleCount === 0 ? 'green' : staleCount <= 3 ? 'amber' : 'red'
  const agedStatus: Status = agedCount === 0 ? 'green' : agedCount <= 5 ? 'amber' : 'red'
  const noHitosStatus: Status = noHitosCount === 0 ? 'green' : 'amber'
  const status = worst(worst(staleStatus, agedStatus), noHitosStatus)

  return NextResponse.json({
    status,
    generatedAt: new Date().toISOString(),
    checks: {
      estados_stale: {
        status: staleStatus,
        count: staleCount,
        detail: 'estado_proceso inscripcion_abierta/convocada con plazo vencido (revisar cron advance-estado)',
        sample: staleRows.slice(0, 10),
      },
      pending_anejas: {
        status: agedStatus,
        count: agedCount,
        detail: `señales OEP pending con más de ${PENDING_STALE_DAYS} días sin revisar`,
      },
      activas_sin_hitos: {
        status: noHitosStatus,
        count: noHitosCount,
        detail: 'oposiciones activas (landing pública) sin ningún hito (timeline vacío)',
        sample: noHitosRows.slice(0, 10).map((r) => r.slug),
      },
    },
  })
}

export const GET = withErrorLogging('/api/admin/oep-consistency', _GET)
