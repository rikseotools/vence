// app/api/cron/audit-annulled-provisions/route.ts
//
// Cron ROTATORIO: audita "incisos anulados por el TC no marcados" (T-009).
//
// POR QUÉ ROTA: el universo son ~357 leyes nacionales y cada una implica
// llamadas a la API datosabiertos del BOE (~125 s en total → no cabe en el
// timeout de un endpoint). Cada tick coge las N MENOS-recientemente-auditadas
// (columna `laws.annulled_audited_at`, NULLS FIRST) y las marca. Con N=40
// diario, el ciclo completo se recorre en ~9 días. Idempotente y escalable.
//
// Flujo:
//   1) Backend @Cron (internal-cron-triggers) lo dispara diario con Bearer CRON_SECRET.
//   2) Selecciona la cola de rotación (activas + BOE-A- + en topic_scope vivo).
//   3) Audita cada ley (lib/laws/annulledAudit → lógica pura de annulledProvisions).
//   4) Emite cada hallazgo a observable_events (kind 'article_annulled_unmarked').
//      El sweep nocturno content-health-sweep los puentea a content_health_findings
//      → panel /admin/salud-sistema + frase-gatillo "revisa los incisos anulados".
//   5) Marca annulled_audited_at=now() en las procesadas + evento resumen.
//
// SEGURIDAD: solo detecta y deja el hallazgo para revisión HUMANA. NUNCA
// auto-corrige una clave (ver runbook incisos-anulados-tc.md).

import { NextResponse, type NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { auditOneLaw, type LawToAudit } from '@/lib/laws/annulledAudit'

export const dynamic = 'force-dynamic'
// 40 leyes × ~0.35 s ≈ 14 s de red. maxDuration holgado; además cortamos por
// presupuesto de reloj (TIME_BUDGET_MS) para no acercarnos al idle del ALB.
export const maxDuration = 60

const DEFAULT_LIMIT = 40
const TIME_BUDGET_MS = 45_000

interface Summary {
  success: boolean
  rotated: number // leyes auditadas este tick
  analysed: number // con análisis BOE
  withAnnulment: number // con anulación TC registrada
  findings: number // hallazgos emitidos (v2)
  duration_ms: number
  timedOut: boolean
  timestamp: string
  error?: string
}

async function _GET(request: NextRequest): Promise<NextResponse<Summary>> {
  const startedAt = Date.now()
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', rotated: 0, analysed: 0, withAnnulment: 0, findings: 0, duration_ms: 0, timedOut: false, timestamp: new Date().toISOString() },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(120, Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)))
  const v2 = url.searchParams.get('v2') !== 'false'

  const db = getAdminDb()

  try {
    // Cola de rotación: activas + BOE consolidado + servidas en algún tema vivo,
    // las menos-recientemente-auditadas primero (NULL = nunca → primero).
    const laws = (await db.execute(sql`
      SELECT l.id, l.short_name, l.boe_url
      FROM laws l
      WHERE l.is_active = true
        AND l.boe_url ~* 'BOE-A-'
        AND EXISTS (
          SELECT 1 FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
          WHERE ts.law_id = l.id AND t.is_active = true
        )
      ORDER BY l.annulled_audited_at NULLS FIRST, l.short_name
      LIMIT ${limit}
    `)) as unknown as LawToAudit[]

    let analysed = 0
    let withAnnulment = 0
    const allFindings: Array<{ law: string; law_id: string; article: string; sentencia: string | null; id_norma: string | null; texto: string }> = []
    const processedIds: string[] = []
    let timedOut = false

    for (const law of laws) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        timedOut = true
        break
      }
      // Artículos que servimos, por número normalizado.
      const arts = (await db.execute(sql`
        SELECT article_number, content FROM articles WHERE law_id = ${law.id}
      `)) as unknown as Array<{ article_number: string; content: string }>
      const byNum = new Map<string, string>(
        arts.map((a) => [String(a.article_number).replace(/\s+/g, ' ').trim().toLowerCase(), a.content]),
      )

      const res = await auditOneLaw(law, byNum, { v2 })
      if (res.analysed) analysed++
      if (res.hasAnnulment) withAnnulment++
      allFindings.push(...res.findings)
      processedIds.push(law.id)
    }

    // Emitir hallazgos (idempotencia ligera: 1 evento por hallazgo/tick; el
    // bridge nocturno deduplica por ley+artículo al escribir content_health_findings).
    for (const f of allFindings) {
      await db.execute(sql`
        INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
        VALUES ('cron', 'warn', 'article_annulled_unmarked', 'audit-annulled-provisions', ${JSON.stringify(f)}::jsonb)
      `)
    }

    // Marcar como auditadas (avanza la rotación) SOLO las realmente procesadas.
    if (processedIds.length) {
      await db.execute(sql`
        UPDATE laws SET annulled_audited_at = now()
        WHERE id IN (${sql.join(processedIds.map((id) => sql`${id}`), sql`, `)})
      `)
    }

    // Evento resumen (heartbeat de contenido, análogo a law_completeness_swept).
    const duration_ms = Date.now() - startedAt
    const summaryMeta = { rotated: processedIds.length, analysed, withAnnulment, findings: allFindings.length, timedOut }
    await db.execute(sql`
      INSERT INTO observable_events (source, severity, event_type, endpoint, duration_ms, metadata)
      VALUES ('cron', 'info', 'annulled_audit_swept', 'audit-annulled-provisions', ${duration_ms}, ${JSON.stringify(summaryMeta)}::jsonb)
    `)

    return NextResponse.json({
      success: true,
      rotated: processedIds.length,
      analysed,
      withAnnulment,
      findings: allFindings.length,
      duration_ms,
      timedOut,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e), rotated: 0, analysed: 0, withAnnulment: 0, findings: 0, duration_ms: Date.now() - startedAt, timedOut: false, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/cron/audit-annulled-provisions', _GET)
