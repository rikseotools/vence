// app/api/cron/check-served-coverage/route.ts
//
// CANARY nocturno de cobertura servida por tema.
//
// Detecta dos fallos silenciosos que dejan un tema "En desarrollo" en el hub de
// tests aunque tenga preguntas:
//   1. MV STALE — el hub lee los conteos de la materialized view
//      topic_law_question_summary (prod TOPIC_MV_ENABLED=true). Si un tema
//      `disponible` tiene preguntas por scope pero la MV le da 0 (oposición
//      recién creada / scope cambiado sin refrescar), sale "En desarrollo".
//   2. DISPONIBLE VACÍO — tema marcado `disponible=true` sin ninguna pregunta
//      en su scope (misconfig).
//
// Motivación: incidente TAI 07/07/2026 (Bloque I, 7.385 preguntas, salía
// "En desarrollo" porque la MV no incluía la oposición nueva). El gate manual
// `audit:served` lo caza al crear una oposición; este canary lo caza de forma
// CONTINUA (regresiones entre refrescos del cron de MV de las 03:30 UTC).
//
// Auth: GHA con Bearer CRON_SECRET. Emite a observable_events si hay hallazgos.

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { emit } from '@/lib/observability/emit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Finding {
  position_type: string
  topic_number: number
  title: string
  mv_total: number
  kind: 'mv_stale' | 'empty_disponible'
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  // El canary solo tiene sentido cuando prod sirve conteos desde la MV.
  const mvEnabled = process.env.TOPIC_MV_ENABLED === 'true'
  const db = getAdminDb()

  try {
    // Por cada topic disponible: ¿tiene preguntas por scope? (EXISTS, corta al
    // primer match → rápido, ~1s para ~2.600 temas) + total que le da la MV.
    // No necesitamos el conteo exacto, solo "tiene o no tiene".
    const rows = (await db.execute(sql`
      SELECT
        t.position_type,
        t.topic_number,
        t.title,
        EXISTS(
          SELECT 1 FROM topic_scope ts
          JOIN articles a ON a.law_id = ts.law_id
            AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
          JOIN questions q ON q.primary_article_id = a.id
            AND q.is_active = true AND q.exam_case_id IS NULL
          WHERE ts.topic_id = t.id
        ) AS has_q,
        COALESCE((SELECT sum(s.total_questions) FROM topic_law_question_summary s WHERE s.topic_id = t.id), 0)::int AS mv_total
      FROM topics t
      WHERE t.is_active = true AND t.disponible = true
    `)) as unknown as Array<{ position_type: string; topic_number: number; title: string; has_q: boolean; mv_total: number }>

    const checked = rows.length
    const findings: Finding[] = []
    for (const r of rows) {
      const base = { position_type: r.position_type, topic_number: r.topic_number, title: r.title, mv_total: r.mv_total }
      if (!r.has_q) {
        findings.push({ ...base, kind: 'empty_disponible' })
      } else if (mvEnabled && r.mv_total === 0) {
        findings.push({ ...base, kind: 'mv_stale' })
      }
    }

    const mvStale = findings.filter(f => f.kind === 'mv_stale').length
    const emptyDisp = findings.filter(f => f.kind === 'empty_disponible').length

    if (findings.length > 0) {
      // Señal a observable_events (fuente de verdad in-house). No falla el
      // endpoint — detectar es su trabajo. `await` para garantizar persistencia.
      await emit({
        source: 'vercel',
        severity: findings.length > 10 ? 'critical' : 'warn',
        eventType: 'served_coverage_gap',
        endpoint: '/api/cron/check-served-coverage',
        errorMessage: `Cobertura servida: ${mvStale} temas con MV stale (saldrían "En desarrollo"), ${emptyDisp} disponibles vacíos`,
        metadata: {
          checked,
          mv_enabled: mvEnabled,
          mv_stale: mvStale,
          empty_disponible: emptyDisp,
          // top 50 para no inflar el evento
          findings: findings.slice(0, 50).map(f => ({ o: f.position_type, t: f.topic_number, mv: f.mv_total, kind: f.kind })),
          hint: mvStale > 0 ? 'Ejecutar: SELECT public.refresh_topic_question_summary();' : undefined,
        },
      })
      console.warn(`⚠️ [ServedCoverage] ${findings.length} hallazgos (${mvStale} MV stale, ${emptyDisp} vacíos) — emitido a observable_events`)
    } else {
      console.log(`✅ [ServedCoverage] OK — ${checked} temas disponibles, 0 gaps`)
    }

    return NextResponse.json({
      success: true,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      stats: {
        checked,
        mv_enabled: mvEnabled,
        mv_stale: mvStale,
        empty_disponible: emptyDisp,
        findings_total: findings.length,
      },
      findings: findings.slice(0, 50),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('❌ [ServedCoverage] error:', msg)
    await emit({
      source: 'vercel',
      severity: 'error',
      eventType: 'served_coverage_error',
      endpoint: '/api/cron/check-served-coverage',
      errorMessage: `check-served-coverage falló: ${msg}`,
      metadata: {},
    }).catch(() => {})
    return NextResponse.json(
      { success: false, error: msg, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}

export const GET = _GET
