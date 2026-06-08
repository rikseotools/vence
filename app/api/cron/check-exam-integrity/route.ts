// app/api/cron/check-exam-integrity/route.ts
// Cron diario: detecta exámenes completados a los que les faltan filas en
// test_questions — la clase de bug que afectó a Rosa (07/06/2026): el examen
// se marca is_completed con score/total correctos, pero las filas por-pregunta
// no se persistieron (saves fire-and-forget perdidos bajo carga) → la página
// /revisar sale vacía y el detalle de aprendizaje se pierde EN SILENCIO.
//
// Una excepción normal NO lo ve: la pérdida es silenciosa (200 OK, datos
// incompletos). Solo un check de integridad sobre la invariante lo caza:
//
//   examen is_completed=true (test_type='exam')  ⟹
//     count(test_questions) ≈ total_questions
//
// Tolerancia 5%: persistExamQuestions omite preguntas retiradas (correctIndex
// -1) por diseño, así que una diferencia de 1-2 filas en exámenes grandes es
// legítima. Solo alertamos si falta >5% de las filas (o el examen está vacío).
//
// Flujo (idéntico a check-stats-drift):
//   1) GHA llama este endpoint cada noche con Bearer CRON_SECRET.
//   2) Query agregada sobre exámenes de las últimas 24h.
//   3) Si hay exámenes con filas faltantes, emite `exam_integrity_drift` a
//      observable_events (fuente de verdad in-house).
//   4) El panel /admin/salud-sistema muestra el indicador para un humano.
//
// Runbook: docs/runbooks/health-check.md

import { NextRequest, NextResponse } from 'next/server'
import { emit } from '@/lib/observability/emit'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
// 15s holgado: es 1 query agregada con índice en (test_id) + filtro por fecha.
export const maxDuration = 15

// Ventana de inspección. 24h por defecto: captura lo nuevo sin arrastrar el
// histórico pre-fix (que tenía filas=0 legítimamente, antes del bulk-write).
const DEFAULT_WINDOW_HOURS = 24
// Fracción mínima de filas presentes para considerar el examen "íntegro".
// 0.95 → tolera hasta 5% de preguntas retiradas omitidas por persistExamQuestions.
const COMPLETENESS_THRESHOLD = 0.95
// Nº de exámenes afectados que escala el evento a 'critical' (alineado con
// DRIFT_RED del panel system-health).
const CRITICAL_AFFECTED_THRESHOLD = 5

interface AffectedExam {
  test_id: string
  total_questions: number
  row_count: number
  missing: number
  completed_at: string | null
}

interface CheckExamIntegrityResponse {
  success: boolean
  duration: string
  stats: {
    window_hours: number
    checked: number      // exámenes inspeccionados en la ventana
    affected: number     // exámenes con filas faltantes >5%
    empty: number        // subconjunto: exámenes con row_count=0 (peor caso)
    worst_missing: number
  }
  top_affected: AffectedExam[]
  timestamp: string
  error?: string
}

async function _GET(request: NextRequest): Promise<NextResponse<CheckExamIntegrityResponse>> {
  // Auth: solo GHA con CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        duration: '0s',
        stats: { window_hours: 0, checked: 0, affected: 0, empty: 0, worst_missing: 0 },
        top_affected: [],
        timestamp: new Date().toISOString(),
      },
      { status: 401 },
    )
  }

  const startTime = Date.now()
  const windowHours = Number(
    new URL(request.url).searchParams.get('window') ?? DEFAULT_WINDOW_HOURS,
  )
  const sinceIso = new Date(startTime - windowHours * 3600_000).toISOString()

  const db = getAdminDb()

  try {
    console.log(`🔍 [ExamIntegrity] Inspeccionando exámenes desde ${sinceIso}`)

    // Cuántos exámenes inspeccionamos (denominador del check).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkedRows = (await db.execute(sql`
      SELECT count(*)::int AS checked
      FROM tests
      WHERE test_type = 'exam'
        AND is_completed = true
        AND completed_at >= ${sinceIso}
        AND total_questions > 0
    `)) as any[]
    const checked = Number(checkedRows[0]?.checked ?? 0)

    // Exámenes a los que les faltan filas (>5% ausentes). LEFT JOIN para
    // contar 0 cuando no hay NINGUNA fila (el peor caso, como el de Rosa).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const affectedRows = (await db.execute(sql`
      SELECT t.id::text AS test_id,
             t.total_questions::int AS total_questions,
             count(tq.id)::int AS row_count,
             (t.total_questions - count(tq.id))::int AS missing,
             t.completed_at
      FROM tests t
      LEFT JOIN test_questions tq ON tq.test_id = t.id
      WHERE t.test_type = 'exam'
        AND t.is_completed = true
        AND t.completed_at >= ${sinceIso}
        AND t.total_questions > 0
      GROUP BY t.id
      HAVING count(tq.id) < t.total_questions * ${COMPLETENESS_THRESHOLD}
      ORDER BY (t.total_questions - count(tq.id)) DESC
      LIMIT 100
    `)) as any[]

    const topAffected: AffectedExam[] = affectedRows.map(r => ({
      test_id: String(r.test_id),
      total_questions: Number(r.total_questions),
      row_count: Number(r.row_count),
      missing: Number(r.missing),
      completed_at: r.completed_at ? String(r.completed_at) : null,
    }))

    const affected = topAffected.length
    const empty = topAffected.filter(e => e.row_count === 0).length
    const worstMissing = topAffected.reduce((max, e) => Math.max(max, e.missing), 0)

    // Señal a observable_events (in-house). NO falla el endpoint: DETECTAR
    // la divergencia es el trabajo del cron. `await` (no fire-and-forget):
    // garantizamos persistencia antes de que la lambda suspenda.
    if (affected > 0) {
      await emit({
        source: 'vercel',
        severity: affected >= CRITICAL_AFFECTED_THRESHOLD ? 'critical' : 'warn',
        eventType: 'exam_integrity_drift',
        endpoint: '/api/cron/check-exam-integrity',
        errorMessage: `Integridad exámenes: ${affected} exámenes con filas faltantes (>${Math.round((1 - COMPLETENESS_THRESHOLD) * 100)}%), ${empty} vacíos`,
        metadata: {
          window_hours: windowHours,
          checked,
          affected,
          empty,
          worst_missing: worstMissing,
          top_affected: topAffected.slice(0, 10),
        },
      })
      console.warn(`⚠️ [ExamIntegrity] ${affected} exámenes incompletos (${empty} vacíos) — emitido a observable_events`)
    } else {
      console.log(`✅ [ExamIntegrity] OK — ${checked} exámenes inspeccionados, 0 con filas faltantes`)
    }

    return NextResponse.json({
      success: true,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      stats: { window_hours: windowHours, checked, affected, empty, worst_missing: worstMissing },
      top_affected: topAffected.slice(0, 20),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ [ExamIntegrity] Error:', errorMsg)

    // Un fallo del propio cron es distinto de la divergencia detectada.
    await emit({
      source: 'vercel',
      severity: 'error',
      eventType: 'cron_error',
      endpoint: '/api/cron/check-exam-integrity',
      errorMessage: errorMsg,
      metadata: { check: 'exam_integrity', component: 'cron_endpoint' },
    })

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        stats: { window_hours: windowHours, checked: 0, affected: 0, empty: 0, worst_missing: 0 },
        top_affected: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/cron/check-exam-integrity', _GET)
