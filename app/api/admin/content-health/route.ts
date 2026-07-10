// app/api/admin/content-health/route.ts
//
// Endpoint admin: salud de CONTENIDO (y app) leída del snapshot que escribe el sweep
// nocturno (scripts/health-sweep.cjs) en `content_health_findings`. NO recalcula la
// auditoría en vivo — lee el snapshot → cero carga en la BD al abrir admin.
//
// Lo consumen: la pestaña "Contenido" de /admin/salud-sistema y el badge del nav.
// Runbook: docs/runbooks/salud-contenido.md

import { NextRequest, NextResponse } from 'next/server'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const ADMIN_EMAILS = ['admin@vencemitfg.es', 'manuel@vencemitfg.es', 'manueltrader@gmail.com']
function isAdmin(email?: string | null): boolean {
  return !!email && (ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es'))
}

interface Finding { category: string; severity: string; oposicion_slug: string | null; kind: string; message: string; computed_at: string }

async function _GET(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/admin/content-health')
  if (!auth.success) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(auth.email)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const db = getReadDb()
  const res = (await db.execute(sql`
    SELECT category, severity, oposicion_slug, kind, message, computed_at
    FROM content_health_findings
    ORDER BY category, (severity = 'error') DESC, oposicion_slug NULLS LAST
  `)) as unknown as { rows?: Finding[] }
  const findings: Finding[] = (res.rows ?? (res as unknown as Finding[])) ?? []

  const n = (cat: string, sev: string) => findings.filter(f => f.category === cat && f.severity === sev).length
  const counts = {
    appError: n('app', 'error'),
    contentError: n('content', 'error'),
    contentWarn: n('content', 'warn'),
  }
  // Semáforo del indicador "Contenido": rojo si hay incoherencias (❌), ámbar si solo
  // menores (🟡), verde si limpio. El badge del nav = ❌ + 🟡 de contenido.
  const status = counts.contentError > 0 ? 'red' : counts.contentWarn > 0 ? 'amber' : 'green'
  const badge = counts.contentError + counts.contentWarn
  const computedAt = findings[0]?.computed_at ?? null
  const stale = computedAt ? (Date.now() - new Date(computedAt).getTime()) > 36 * 3600 * 1000 : true // >36h sin sweep → sospechoso

  return NextResponse.json({
    counts,
    status,
    badge,
    computedAt,
    stale,
    content: findings.filter(f => f.category === 'content'),
    app: findings.filter(f => f.category === 'app'),
  })
}

export const GET = withErrorLogging('/api/admin/content-health', _GET)
