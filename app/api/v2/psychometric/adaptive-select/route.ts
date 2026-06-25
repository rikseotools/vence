// app/api/v2/psychometric/adaptive-select/route.ts
// Selección adaptativa de preguntas psicotécnicas para el usuario AUTENTICADO:
// reordena las preguntas disponibles (no-vistas primero + repaso espaciado) y,
// si hay rendimiento suficiente, filtra por dificultad efectiva. user_id del TOKEN.
// NO es anti-scraping: opera sobre IDs ya cargados y NO devuelve la respuesta correcta.
//
// AGNÓSTICO (Fase C1): porta server-side la lógica que el cliente hacía con
// supabase.rpc('get_effective_psychometric_difficulty') (N+1 → batch con LATERAL)
// + supabase.from('psychometric_test_answers'). Devuelve solo IDs ordenados.
//
// NOTA: el logAdaptiveDecision original insertaba en psychometric_adaptive_logs, una
// tabla que NO existe → siempre fallaba en silencio (no-op). Se omite (fiel: nunca logó).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 20

function rows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as Record<string, unknown>[]
}

function convertBaseDifficultyToNumeric(d: string | undefined): number {
  switch (d) {
    case 'easy': return 25.0
    case 'hard': return 75.0
    case 'medium': return 50.0
    default: return 50.0
  }
}

function shuffle<T>(array: T[]): T[] {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface QInput { id: string; difficulty?: string }

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/psychometric/adaptive-select')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const questions: QInput[] = (Array.isArray(body?.questions) ? body.questions : [])
    .filter((q: QInput) => q && typeof q.id === 'string' && UUID_RE.test(q.id))
  const perf = body?.currentPerformance as
    | { questionsAnswered: number; correctAnswers: number; incorrectStreak: number }
    | null
    | undefined
  const ids = questions.map((q) => q.id)

  const db = getAdminDb()

  // Historial de respuestas del usuario (para priorización no-vistas-primero).
  const answers = rows(await db.execute(sql`
    SELECT question_id, created_at FROM psychometric_test_answers
    WHERE user_id = ${auth.userId}::uuid
    ORDER BY created_at DESC
  `)) as { question_id: string; created_at: string }[]

  // Priorización: no vistas primero (barajadas) + ya respondidas por antigüedad asc.
  const prioritize = (pool: string[]): string[] => {
    if (!answers.length) return shuffle(pool)
    const answered = new Set<string>()
    const lastAnswered = new Map<string, number>()
    for (const a of answers) {
      answered.add(a.question_id)
      const t = new Date(a.created_at).getTime()
      if (!lastAnswered.has(a.question_id) || t > (lastAnswered.get(a.question_id) as number)) {
        lastAnswered.set(a.question_id, t)
      }
    }
    const neverSeen = pool.filter((id) => !answered.has(id))
    const seen = pool.filter((id) => answered.has(id))
      .sort((x, y) => (lastAnswered.get(x) || 0) - (lastAnswered.get(y) || 0))
    return [...shuffle(neverSeen), ...seen]
  }

  // Caso 1: sin datos de rendimiento → barajado simple (fiel al original).
  if (!perf) {
    return NextResponse.json({ success: true, orderedIds: shuffle(ids), filterApplied: 'none' })
  }

  const { questionsAnswered, correctAnswers, incorrectStreak } = perf

  // Caso 2: baseline (primeras 2 respuestas) → solo priorización, sin filtro de dificultad.
  if (questionsAnswered < 2) {
    return NextResponse.json({ success: true, orderedIds: prioritize(ids), filterApplied: 'none' })
  }

  // Caso 3: filtro adaptativo por dificultad efectiva.
  const accuracy = correctAnswers / questionsAnswered
  const needsEasier = accuracy < 0.6 || incorrectStreak >= 2

  // Dificultad efectiva de TODAS las preguntas en UNA query (batch del N+1 con LATERAL).
  const diffMap = new Map<string, number>()
  if (ids.length) {
    try {
      // ids ya validados como UUID. Lista parametrizada con sql.join (drizzle hace
      // SPREAD de un array JS, no lo bindea como array Postgres → `${ids}::uuid[]` falla).
      const idList = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)
      const diffRows = rows(await db.execute(sql`
        SELECT t.id, d.effective_difficulty::float8 AS eff
        FROM unnest(ARRAY[${idList}]) AS t(id)
        CROSS JOIN LATERAL get_effective_psychometric_difficulty(t.id, ${auth.userId}::uuid) d
      `)) as { id: string; eff: number }[]
      for (const r of diffRows) diffMap.set(r.id, Number(r.eff))
    } catch (e) {
      console.warn('⚠️ [adaptive-select] difficultad batch falló, usando base:', (e as Error).message)
    }
  }

  const withDiff = questions.map((q) => ({
    id: q.id,
    eff: diffMap.has(q.id) ? (diffMap.get(q.id) as number) : convertBaseDifficultyToNumeric(q.difficulty),
  }))

  let filtered = withDiff
  if (needsEasier) {
    filtered = withDiff.filter((q) => q.eff < 45)
    if (filtered.length === 0) {
      filtered = [...withDiff].sort((a, b) => a.eff - b.eff).slice(0, Math.ceil(withDiff.length * 0.4))
    }
  }

  return NextResponse.json({
    success: true,
    orderedIds: prioritize(filtered.map((q) => q.id)),
    filterApplied: needsEasier ? 'easy' : 'none',
  })
}

export const POST = withErrorLogging('/api/v2/psychometric/adaptive-select', _POST)
