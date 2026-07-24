import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { parseLetterFormatExplanation, StructuredExplanation } from '@/lib/shuffle/structuredExplanation'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

/**
 * DEBUG (solo dev): devuelve preguntas reales `full` con explicación §8.1, ya parseadas
 * a formato estructurado (`explanation_data`) para la demo de barajado de la Fase 2.
 * No expone nada nuevo (es material que la app ya sirve); es una vista de inspección.
 *
 * GET /api/debug/shuffle-demo?n=8
 */
export const dynamic = 'force-dynamic'

async function _GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'debug route disabled in production' }, { status: 403 })
  }
  const url = new URL(req.url)
  const n = Math.min(30, Math.max(1, parseInt(url.searchParams.get('n') || '8', 10)))

  const db = getDb()
  // Preguntas activas, full, con explicación §8.1 letra-anclada (las que la Fase 2
  // desbloquea). Muestreo variado por id.
  const rows = (await db.execute(sql`
    SELECT id, question_text, correct_option, option_a, option_b, option_c, option_d, explanation
    FROM questions
    WHERE is_active AND shuffle_mode = 'full'
      AND explanation LIKE '%Por qué%'
      AND explanation LIKE '%son incorrectas%'
      AND option_d IS NOT NULL AND option_d <> ''
    ORDER BY md5(id::text)
    LIMIT ${n * 3}
  `)) as unknown as Array<{
    id: string
    question_text: string
    correct_option: number
    option_a: string | null
    option_b: string | null
    option_c: string | null
    option_d: string | null
    explanation: string
  }>

  const out: Array<{
    id: string
    question_text: string
    correct_option: number
    options: string[]
    explanation: string
    structured: StructuredExplanation
  }> = []

  for (const q of rows) {
    if (out.length >= n) break
    const options = [q.option_a, q.option_b, q.option_c, q.option_d].filter(
      (v): v is string => v != null && v !== ''
    )
    if (options.length < 4 || q.correct_option == null || q.correct_option >= options.length) continue
    const structured = parseLetterFormatExplanation(q.explanation, {
      correctOption: q.correct_option,
      nOptions: options.length,
    })
    if (!structured) continue // solo las migrables por parser determinista (demo limpia)
    out.push({
      id: q.id,
      question_text: q.question_text,
      correct_option: q.correct_option,
      options,
      explanation: q.explanation,
      structured,
    })
  }

  return NextResponse.json({ count: out.length, questions: out })
}

// Convención del repo: TODO endpoint pasa por withErrorLogging (observabilidad de
// errores 4xx/5xx + endpoint path). El guardarraíl __tests__/lib/api/withErrorLogging
// lo exige; este debug endpoint no era una excepción legítima.
export const GET = withErrorLogging('/api/debug/shuffle-demo', _GET)
