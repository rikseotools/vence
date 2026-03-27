// app/api/admin/question-quality/route.ts
// API para detectar problemas de calidad en preguntas activas

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb as getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
interface QualityIssue {
  id: string
  question_text: string
  field: string
}

interface CheckResult {
  count: number
  questions: QualityIssue[]
}

interface QualityResponse {
  success: boolean
  totalIssues: number
  checks: {
    empty_options: CheckResult
    banned_words: CheckResult
    pending_explanation: CheckResult
    missing_article: CheckResult
    missing_image: CheckResult
    excel_typo: CheckResult
    copied_explanation: CheckResult
    cramped_explanation: CheckResult
    duplicate_questions: CheckResult
  }
}

// Caché en memoria (5 min) - separate caches for counts and full data
let cacheCountOnly: { totalIssues: number; ts: number } | null = null
let cacheFull: { data: QualityResponse; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

const MAX_ITEMS = 50
const TEXT_LIMIT = 120
const SIMILARITY_THRESHOLD = 0.9

// Single regex that covers all banned word variants (much faster than 576 ilikes)
// Regex for questions referencing images/screenshots that aren't shown
// Patterns for questions that reference visual content not available (images, icons, tables, screenshots)
const MISSING_IMAGE_REGEX = '(?i)(siguiente imagen|imagen que se muestra|imagen que aparece|la imagen de Excel|la imagen de Access|la imagen de Word|de la imagen de|celda de la imagen|analizando la imagen|la imagen adjunta|imagen que se adjunta|captura de pantalla que se muestra|pantalla que se muestra|icono que aparece en la siguiente|icono que muestra la siguiente|icono que puedes ver en la siguiente|icono que aparece a continuación|observa la siguiente captura|según la siguiente imagen|relación con la siguiente imagen|observe la siguiente imagen|figura que aparece a continuación|rango de datos que aparece a continuación|tabla adjunta|documento adjunto|gráfico siguiente|hoja de cálculo siguiente|siguiente hoja de cálculo|sigui?ente figura|figura que aparece entre|figura de ejemplo|observa la figura|aparece en la figura|siguiente icono|como se muestra en la imagen|como se puede ver en la imagen|que aparece en la imagen|aparecen en la imagen|mostrad[oa] en la imagen|en la imagen de Excel|en la imagen de Access|en la imagen de Word|en la imagen siguiente|de la figura siguiente|icono de la figura)'

// Excel functions written without the required period (e.g. SIERROR instead of SI.ERROR)
// eslint-disable-next-line no-useless-escape
const EXCEL_TYPO_REGEX = '(?i)(\\\\mSIERROR\\\\M|\\\\mCONTARSI\\\\M|\\\\mSUMARSI\\\\M)'

const BANNED_REGEX = '(?i)(oposita\\\\s*[-_.]?\\\\s*test|opositest|oposistatest|opossita|opositatets|opostia|opsita|opositatestt|opositates[^t]|oposiitatest|oppositatest|opoositatest|opositattest|opositateest|opositatesst|0positatest|opositat3st|op0sitatest|0p0sitatest|opos1tatest|oposi7atest|oposita7est|opositat€st|o[-._]p[-._]o[-._]s[-._]i[-._]t[-._]a[-._]t[-._]e[-._]s[-._]t)'

function truncate(text: string): string {
  return text.length > TEXT_LIMIT ? text.slice(0, TEXT_LIMIT) + '...' : text
}

/** Fast path: only return total issue count (used by layout badge polling) */
async function runCountsOnly(): Promise<number> {
  const db = getDb()

  // Single query with FILTER clauses to count all checks in one table scan
  const result = await db.execute(sql`
    WITH base AS (
      SELECT
        count(*) FILTER (WHERE
          option_a = '' OR option_b = '' OR option_c = '' OR option_d = ''
        ) as empty_options,
        count(*) FILTER (WHERE
          CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d, explanation) ~* ${BANNED_REGEX}
        ) as banned_words,
        count(*) FILTER (WHERE
          explanation ILIKE '%pendiente de explicación%' OR explanation ILIKE '%pendiente de explicacion%'
        ) as pending_explanation,
        count(*) FILTER (WHERE primary_article_id IS NULL) as missing_article,
        count(*) FILTER (WHERE question_text ~* ${MISSING_IMAGE_REGEX}) as missing_image,
        count(*) FILTER (WHERE
          CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d) ~* ${EXCEL_TYPO_REGEX}
        ) as excel_typo,
        count(*) FILTER (WHERE
          explanation IS NOT NULL AND LENGTH(explanation) > 400
          AND explanation NOT LIKE '%' || chr(10) || '%'
        ) as cramped_explanation
      FROM questions
      WHERE is_active = true
    ),
    similarity_count AS (
      SELECT count(*)::int as copied
      FROM questions q
      JOIN articles a ON q.primary_article_id = a.id
      WHERE q.is_active = true
        AND a.content IS NOT NULL
        AND LENGTH(a.content) > 50
        AND LENGTH(q.explanation) > 50
        AND similarity(q.explanation, a.content) >= ${SIMILARITY_THRESHOLD}
    ),
    duplicate_count AS (
      SELECT COALESCE(SUM(cnt)::int, 0) as duplicates
      FROM (
        SELECT count(*) - 1 as cnt
        FROM questions
        WHERE is_active = true
        GROUP BY question_text
        HAVING count(*) > 1
      ) d
    )
    SELECT (b.empty_options + b.banned_words + b.pending_explanation + b.missing_article + b.missing_image + b.excel_typo + b.cramped_explanation + s.copied + dup.duplicates)::int as total
    FROM base b, similarity_count s, duplicate_count dup
  `)

  const rows = (result as any).rows ?? result ?? []
  return rows[0]?.total ?? 0
}

/** Full check: returns counts + sample questions for each check */
async function runChecks(): Promise<QualityResponse> {
  const db = getDb()

  // Run all data queries with count(*) OVER() to get totals without separate count queries
  const results = await Promise.all([
    // 1. Empty options
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND (option_a = '' OR option_b = '' OR option_c = '' OR option_d = '')
      LIMIT ${MAX_ITEMS}
    `),

    // 2. Banned words (single regex instead of 576 ilikes)
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             question_text as full_question_text,
             option_a, option_b, option_c, option_d, explanation,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d, explanation) ~* ${BANNED_REGEX}
      LIMIT ${MAX_ITEMS}
    `),

    // 3. Pending explanation
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND (explanation ILIKE '%pendiente de explicación%' OR explanation ILIKE '%pendiente de explicacion%')
      LIMIT ${MAX_ITEMS}
    `),

    // 4. Missing article
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true AND primary_article_id IS NULL
      LIMIT ${MAX_ITEMS}
    `),

    // 5. Missing image (references screenshots/images not shown)
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND question_text ~* ${MISSING_IMAGE_REGEX}
      LIMIT ${MAX_ITEMS}
    `),

    // 6. Excel function typos (e.g. SIERROR instead of SI.ERROR)
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             question_text as full_question_text,
             option_a, option_b, option_c, option_d,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d) ~* ${EXCEL_TYPO_REGEX}
      LIMIT ${MAX_ITEMS}
    `),

    // 7. Cramped explanation (>400 chars without any line break)
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             LENGTH(explanation) as len,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND explanation IS NOT NULL
        AND LENGTH(explanation) > 400
        AND explanation NOT LIKE '%' || chr(10) || '%'
      ORDER BY LENGTH(explanation) DESC
      LIMIT ${MAX_ITEMS}
    `),

    // 8. Copied explanation (similarity)
    db.execute(sql`
      SELECT q.id, LEFT(q.question_text, ${TEXT_LIMIT}) as question_text,
             ROUND(similarity(q.explanation, a.content)::numeric, 2) as sim,
             count(*) OVER()::int as total_count
      FROM questions q
      JOIN articles a ON q.primary_article_id = a.id
      WHERE q.is_active = true
        AND a.content IS NOT NULL
        AND LENGTH(a.content) > 50
        AND LENGTH(q.explanation) > 50
        AND similarity(q.explanation, a.content) >= ${SIMILARITY_THRESHOLD}
      ORDER BY similarity(q.explanation, a.content) DESC
      LIMIT ${MAX_ITEMS}
    `),

    // 9. Duplicate questions (same question_text, multiple active)
    // Only show ONE row per duplicate group (not all copies)
    db.execute(sql`
      WITH dupe_groups AS (
        SELECT question_text, count(*) as cnt
        FROM questions
        WHERE is_active = true
        GROUP BY question_text
        HAVING count(*) > 1
      )
      SELECT DISTINCT ON (d.question_text)
             q.id, LEFT(q.question_text, ${TEXT_LIMIT}) as question_text,
             d.cnt,
             (SELECT COALESCE(SUM(cnt - 1)::int, 0) FROM dupe_groups) as total_count
      FROM questions q
      JOIN dupe_groups d ON q.question_text = d.question_text
      WHERE q.is_active = true
      ORDER BY d.question_text, q.created_at ASC
      LIMIT ${MAX_ITEMS}
    `),
  ])

  const toRows = (r: any) => (r as any).rows ?? r ?? []

  const [emptyOpts, bannedRaw, pendingExpl, missingArt, missingImg, excelTypoRaw, crampedExplRaw, copiedExplRaw, duplicateRaw] = results

  const emptyRows = toRows(emptyOpts)
  const bannedRows = toRows(bannedRaw)
  const pendingRows = toRows(pendingExpl)
  const missingRows = toRows(missingArt)
  const missingImgRows = toRows(missingImg)
  const excelTypoRows = toRows(excelTypoRaw)
  const crampedRows = toRows(crampedExplRaw)
  const copiedRows = toRows(copiedExplRaw)
  const duplicateRows = toRows(duplicateRaw)

  // Detect which field has banned word
  const bannedRegexJs = new RegExp(BANNED_REGEX.replace('(?i)', ''), 'i')
  const bannedWithField = bannedRows.map((q: any) => {
    let field = 'question_text'
    if (bannedRegexJs.test(q.option_a)) field = 'option_a'
    else if (bannedRegexJs.test(q.option_b)) field = 'option_b'
    else if (bannedRegexJs.test(q.option_c)) field = 'option_c'
    else if (bannedRegexJs.test(q.option_d)) field = 'option_d'
    else if (bannedRegexJs.test(q.explanation)) field = 'explanation'
    return { id: q.id, question_text: q.question_text, field }
  })

  // Detect which field has the Excel typo
  const excelTypoRegexJs = new RegExp(EXCEL_TYPO_REGEX.replace('(?i)', '').replace(/\\m/g, '\\b').replace(/\\M/g, '\\b'), 'i')
  const excelTypoWithField = excelTypoRows.map((q: any) => {
    let field = 'question_text'
    if (excelTypoRegexJs.test(q.option_a)) field = 'option_a'
    else if (excelTypoRegexJs.test(q.option_b)) field = 'option_b'
    else if (excelTypoRegexJs.test(q.option_c)) field = 'option_c'
    else if (excelTypoRegexJs.test(q.option_d)) field = 'option_d'
    return { id: q.id, question_text: q.question_text, field }
  })

  const copiedExpl: QualityIssue[] = copiedRows.map((r: any) => ({
    id: r.id,
    question_text: r.question_text + (r.question_text?.length >= TEXT_LIMIT ? '...' : ''),
    field: `similarity: ${r.sim}`,
  }))

  const getCount = (rows: any[]) => rows[0]?.total_count ?? 0

  const checks = {
    empty_options: {
      count: getCount(emptyRows),
      questions: emptyRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'options',
      })),
    },
    banned_words: {
      count: getCount(bannedRows),
      questions: bannedWithField,
    },
    pending_explanation: {
      count: getCount(pendingRows),
      questions: pendingRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'explanation',
      })),
    },
    missing_article: {
      count: getCount(missingRows),
      questions: missingRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'primary_article_id',
      })),
    },
    missing_image: {
      count: getCount(missingImgRows),
      questions: missingImgRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'image_reference',
      })),
    },
    excel_typo: {
      count: getCount(excelTypoRows),
      questions: excelTypoWithField,
    },
    cramped_explanation: {
      count: getCount(crampedRows),
      questions: crampedRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: `${q.len} chars`,
      })),
    },
    copied_explanation: {
      count: getCount(copiedRows),
      questions: copiedExpl,
    },
    duplicate_questions: {
      count: getCount(duplicateRows),
      questions: duplicateRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: `${q.cnt} copias`,
      })),
    },
  }

  const totalIssues =
    checks.empty_options.count +
    checks.banned_words.count +
    checks.pending_explanation.count +
    checks.missing_article.count +
    checks.missing_image.count +
    checks.excel_typo.count +
    checks.cramped_explanation.count +
    checks.copied_explanation.count +
    checks.duplicate_questions.count

  return { success: true, totalIssues, checks }
}

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'mark_copied_for_review') {
      const db = getDb()

      // Marcar como pendientes de revisión (no sobreescribir estados de error existentes)
      const result = await db.execute(sql`
        UPDATE questions
        SET topic_review_status = 'pending',
            verification_status = NULL,
            verified_at = NULL
        WHERE id IN (
          SELECT q.id
          FROM questions q
          JOIN articles a ON q.primary_article_id = a.id
          WHERE q.is_active = true
            AND a.content IS NOT NULL
            AND LENGTH(a.content) > 50
            AND LENGTH(q.explanation) > 50
            AND similarity(q.explanation, a.content) >= ${SIMILARITY_THRESHOLD}
            AND (q.topic_review_status IS NULL OR q.topic_review_status = 'perfect')
        )
        RETURNING id
      `)

      const updated = (result as any).rows?.length ?? (result as any).length ?? 0

      // Invalidar cachés
      cacheCountOnly = null
      cacheFull = null

      return NextResponse.json({ success: true, updated })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('❌ [API/admin/question-quality] POST Error:', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countOnly = searchParams.get('count_only') === 'true'
    const refresh = searchParams.get('refresh') === 'true'

    if (countOnly) {
      // Fast path: only counts (used by admin layout badge every 30s)
      if (cacheCountOnly && !refresh && Date.now() - cacheCountOnly.ts < CACHE_TTL) {
        return NextResponse.json({ success: true, totalIssues: cacheCountOnly.totalIssues })
      }
      const totalIssues = await runCountsOnly()
      cacheCountOnly = { totalIssues, ts: Date.now() }
      return NextResponse.json({ success: true, totalIssues })
    }

    // Full path: counts + sample questions
    if (cacheFull && !refresh && Date.now() - cacheFull.ts < CACHE_TTL) {
      return NextResponse.json(cacheFull.data)
    }
    const result = await runChecks()
    cacheFull = { data: result, ts: Date.now() }
    // Also update count cache
    cacheCountOnly = { totalIssues: result.totalIssues, ts: Date.now() }
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/admin/question-quality] Error:', error)
    return NextResponse.json(
      { success: false, totalIssues: 0, error: 'Error interno' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/admin/question-quality', _POST)
export const GET = withErrorLogging('/api/admin/question-quality', _GET)
