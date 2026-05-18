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
    html_explanation: CheckResult
    wrong_article_law: CheckResult
    copied_explanation: CheckResult
    cramped_explanation: CheckResult
    duplicate_questions: CheckResult
    psy_empty_options: CheckResult
    uncited_explanation: CheckResult
    outdated_plan: CheckResult
    psy_missing_figures: CheckResult
    psy_html_explanation: CheckResult
    psy_duplicate_questions: CheckResult
    psy_implicit_table: CheckResult
    psy_auto_classified_unverified: CheckResult
    regional_wrong_law: CheckResult
    mismatched_answer: CheckResult
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
// NOTE: "anexo Word/Excel/Access" removed — those are exam context references, not visual content requirements
const MISSING_IMAGE_REGEX = '(?i)(siguiente imagen|imagen que se muestra|imagen que aparece|la imagen de Excel|la imagen de Access|la imagen de Word|de la imagen de|celda de la imagen|analizando la imagen|la imagen adjunta|imagen que se adjunta|captura de pantalla que se muestra|pantalla que se muestra|icono que aparece en la siguiente|icono que muestra la siguiente|icono que puedes ver en la siguiente|icono que aparece a continuación|observa la siguiente captura|según la siguiente imagen|relación con la siguiente imagen|observe la siguiente imagen|figura que aparece a continuación|rango de datos que aparece a continuación|tabla adjunta|documento adjunto|gráfico siguiente|hoja de cálculo siguiente|siguiente hoja de cálculo|sigui?ente figura|figura que aparece entre|figura de ejemplo|observa la figura|aparece en la figura|siguiente icono|siguiente marca|como se muestra en la imagen|como se puede ver en la imagen|que aparece en la imagen|aparecen en la imagen|mostrad[oa] en la imagen|en la imagen de Excel|en la imagen de Access|en la imagen de Word|en la imagen siguiente|de la figura siguiente|icono de la figura|tabla mostrad[oa]|fórmula mostrad[oa]|mostrad[oa] a continuación|columna .{1,3} del anexo|supuesto Excel|como muestra la figura|ver a continuación.*celda|fórmula.{1,15}aplicada en la celda|parte derecha de la f|aspecto de la hoja de cálculo|hoja (?:Excel|de cálculo) mostrad[oa])'

// HTML entities or tags in explanation (should be markdown)
// Generic pattern: catches ANY HTML entity (&xxx;) and common HTML tags
const HTML_EXPLANATION_REGEX = '(&[a-zA-Z]+;|<p>|<p |</p>|<strong>|</strong>|<b>|<b |</b>|<i>|</i>|<br>|<br/>|<br />|<em>|</em>|<ul>|<li>|</li>|</ul>|<ol>|</ol>|<h[1-6]>|<div>|</div>|<span[ >]|</span>|<u>|</u>)'

// Excel functions written without the required period (e.g. SIERROR instead of SI.ERROR)
// eslint-disable-next-line no-useless-escape
const EXCEL_TYPO_REGEX = '(?i)(\\mSIERROR\\M|\\mCONTARSI\\M|\\mSUMARSI\\M)'

// Plans/strategies that are no longer current (superseded by newer versions)
// IV Plan de Gobierno Abierto (2020-2024) → superseded by V Plan (2025-2029)
// Add more patterns here as plans get superseded
const OUTDATED_PLAN_REGEX = '(?i)(\\m(I|II|III|IV)\\s+Plan\\s+de\\s+Gobierno\\s+Abierto)'

// Preguntas revisadas manualmente que mencionan planes antiguos pero son válidas
// (preguntas históricas en pasado, no contenido desactualizado)
const OUTDATED_PLAN_REVIEWED_IDS = [
  '6b4f9c91-6fcc-4470-b8c0-9e4bc48e5b99', // "¿Qué Plan incluyó el Foro?" — pregunta histórica en pasado
  '815dd117-c237-4d36-bda3-e6bf774c537f', // "¿En qué año se presentó el I Plan?" — dato factual
]

// Preguntas que matchean MISSING_IMAGE_REGEX pero son autocontenidas o usan "imagen"
// en sentido figurado (identidad corporativa, derecho a la propia imagen, etc.)
const MISSING_IMAGE_REVIEWED_IDS = [
  '2732d586-8515-430a-ac2f-1ea835c7a67e', // Excel B3 "supuesto Excel" — datos embebidos inline
  '34fff735-72e5-4c88-aae3-7770537820e7', // Guardia Civil — "protección de la imagen de la ciudadanía" (derecho)
  'ded77b53-287f-4fa7-ae44-58c1bbc2b87e', // Policía Nacional — "imagen" = identidad corporativa
  'e2dce240-ca2a-4689-b246-7d44187d9ba8', // CALC fórmula — opción correcta deducible del enunciado
]

// Explanation says "La respuesta correcta es **X" but correct_option doesn't match
// \M = end-of-word boundary: prevents matching "correcta es correcta" (C not at word end)
const MISMATCHED_ANSWER_REGEX = '(?i)(?:respuesta|opci[oó]n) correcta es (?:la )?\\*?\\*?([A-D])\\M'

const BANNED_REGEX = '(?i)(oposita\\s*[-_./@*]?\\s*test|opositest|oposistatest|opossita|opositatets|opostia|opsita|opositatestt|opositates[^t]|oposiitatest|oppositatest|opoositatest|opositattest|opositateest|opositatesst|0positatest|opositat3st|op0sitatest|0p0sitatest|opos1tatest|oposi7atest|oposita7est|opositat€st|o[-_./@* ]p[-_./@* ]o[-_./@* ]s[-_./@* ]i[-_./@* ]t[-_./@* ]a[-_./@* ]t[-_./@* ]e[-_./@* ]s[-_./@* ]t|tu\\s*test\\s*digital|tutestdigital|tutest\\s*online|tutestonline|tu\\s*test\\s*on\\s*line|tutestdigita1|tut3stdigital|tu[-_./@* ]test[-_./@* ]digital|aula\\s*[-_./@*]?\\s*plus|aulaplus\\s*formaci[óo]n|aulaplus\\.?(es|com|net|info)|aulap1us|au1aplus|auIaplus|aulapIus|aulapluz|aulapluss|a[-_./@* ]u[-_./@* ]l[-_./@* ]a[-_./@* ]p[-_./@* ]l[-_./@* ]u[-_./@* ]s)'

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
          option_a = '' OR option_b = '' OR option_c = '' OR option_d = '' OR option_d = ''
        ) as empty_options,
        count(*) FILTER (WHERE
          CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d, explanation) ~* ${BANNED_REGEX}
        ) as banned_words,
        count(*) FILTER (WHERE
          explanation ILIKE '%pendiente de explicación%' OR explanation ILIKE '%pendiente de explicacion%'
        ) as pending_explanation,
        count(*) FILTER (WHERE primary_article_id IS NULL) as missing_article,
        count(*) FILTER (WHERE question_text ~* ${MISSING_IMAGE_REGEX} AND question_text NOT ILIKE '%Observatorio de la Imagen%' AND image_url IS NULL AND (content_data IS NULL OR content_data::text = '{}') AND id NOT IN (${sql.join(MISSING_IMAGE_REVIEWED_IDS.map(id => sql`${id}::uuid`), sql`, `)})) as missing_image,
        count(*) FILTER (WHERE
          CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d) ~* ${EXCEL_TYPO_REGEX}
          AND question_text NOT ILIKE '%Calc%'
          AND question_text NOT ILIKE '%LibreOffice%'
          AND question_text NOT ILIKE '%OpenOffice%'
        ) as excel_typo,
        count(*) FILTER (WHERE
          explanation ~* ${HTML_EXPLANATION_REGEX}
        ) as html_explanation,
        count(*) FILTER (WHERE
          explanation IS NOT NULL AND LENGTH(explanation) > 400
          AND explanation NOT LIKE '%' || chr(10) || '%'
        ) as cramped_explanation,
        count(*) FILTER (WHERE
          CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d) ~* ${OUTDATED_PLAN_REGEX}
          AND id NOT IN (${sql.join(OUTDATED_PLAN_REVIEWED_IDS.map(id => sql`${id}::uuid`), sql`, `)})
        ) as outdated_plan,
        count(*) FILTER (WHERE
          explanation ~* ${MISMATCHED_ANSWER_REGEX}
          AND correct_option != CASE upper(substring(explanation from ${MISMATCHED_ANSWER_REGEX}))
            WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3
          END
        ) as mismatched_answer
      FROM questions
      WHERE is_active = true
    ),
    uncited_count AS (
      SELECT count(*)::int as uncited
      FROM questions q
      JOIN articles a ON q.primary_article_id = a.id
      JOIN laws l ON a.law_id = l.id
      WHERE q.is_active = true
        AND l.is_virtual IS NOT TRUE
        AND q.explanation IS NOT NULL
        AND LENGTH(q.explanation) > 20
        AND q.explanation NOT ILIKE '%pendiente de explicación%'
        AND q.explanation NOT ILIKE '%pendiente de explicacion%'
        AND q.explanation NOT LIKE '%>%'
        AND q.explanation !~* '(Art[íi]culo|\\mArt\\.)'
        AND a.article_number NOT IN ('0', '00', 'preámbulo', 'Preámbulo', 'General', 'Retos', 'I', 'II', 'III', 'IV')
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
    -- Preguntas duplicadas: mismo texto + mismas opciones (barajadas) + mismo artículo.
    -- Preguntas con mismo texto pero opciones o artículos diferentes son legítimas
    -- (ej: misma pregunta para auxiliar y administrativo con artículos distintos).
    duplicate_count AS (
      SELECT COALESCE(SUM(cnt)::int, 0) as duplicates
      FROM (
        SELECT count(*) - 1 as cnt
        FROM questions
        WHERE is_active = true
        GROUP BY question_text, primary_article_id,
          (SELECT string_agg(opt, '|||' ORDER BY opt) FROM unnest(ARRAY[option_a, option_b, option_c, option_d]) AS opt)
        HAVING count(*) > 1
      ) d
    ),
    -- Preguntas cuyo texto menciona una app (Access, Word, Excel, etc.)
    -- pero están vinculadas a un artículo de otra ley diferente.
    wrong_law_count AS (
      SELECT count(*)::int as wrong_law
      FROM questions q
      JOIN articles a ON q.primary_article_id = a.id
      JOIN laws l ON a.law_id = l.id
      WHERE q.is_active = true AND (
        -- Excluir leyes técnicas/informáticas, apps Office (que cruzan menciones entre sí) e idiomas
        l.short_name NOT ILIKE '%Informática%'
        AND l.short_name NOT ILIKE '%Windows%'
        AND l.short_name NOT ILIKE '%Explorador%'
        AND l.short_name NOT ILIKE '%Red Internet%'
        AND l.short_name NOT ILIKE '%Correo%'
        AND l.short_name NOT ILIKE '%Microsoft 365%'
        AND l.short_name NOT ILIKE '%Word%'
        AND l.short_name NOT ILIKE '%Excel%'
        AND l.short_name NOT ILIKE '%Access%'
        AND l.short_name NOT ILIKE '%Outlook%'
        AND l.short_name NOT ILIKE '%OneDrive%'
        AND l.short_name NOT ILIKE '%Teams%'
        AND l.short_name NOT ILIKE '%SharePoint%'
        AND l.short_name NOT ILIKE '%hoja%'
        AND l.short_name NOT ILIKE '%procesador%'
        AND l.short_name NOT ILIKE '%Inglés%'
        AND l.short_name NOT ILIKE '%Ingles%'
        AND l.short_name NOT ILIKE '%English%'
        AND (
          q.question_text ~* '\\mAccess\\M'
          OR (q.question_text ~* '\\mExcel\\M' AND q.question_text !~* '\\mexcelencia\\M')
          OR (q.question_text ~* '\\mWord\\M' AND q.question_text !~* '\\mWordPress\\M')
          OR q.question_text ~* '\\mOutlook\\M'
          OR q.question_text ~* '\\mOneDrive\\M'
          OR q.question_text ~* '\\mTeams\\M'
          OR q.question_text ~* '\\mSharePoint\\M'
        )
      )
    ),
    -- Checks de psicotécnicas
    psy_base AS (
      SELECT
        count(*) FILTER (WHERE
          option_a = '' OR option_b = '' OR option_c = '' OR option_d = ''
        ) as psy_empty,
        count(*) FILTER (WHERE
          (question_text ILIKE '%serie de figuras%' OR question_text ILIKE '%siguiente imagen%' OR question_text ILIKE '%siguiente gráfico%' OR question_text ILIKE '%tabla I y marcar%' OR question_text ILIKE '%observe la figura%' OR question_text ILIKE '%sustituya a la interrogaci%' OR question_text ILIKE '%sustituya al interrogante%' OR question_text ILIKE '%ocupe el lugar%')
          AND (content_data IS NULL OR content_data::text = '{}')
          AND image_url IS NULL
        ) as psy_figures,
        count(*) FILTER (WHERE
          explanation ~* ${HTML_EXPLANATION_REGEX}
        ) as psy_html,
        -- Auto-clasificadas pero no verificadas (importadas por un clasificador automático
        -- y nunca revisadas por humano — riesgo de mal clasificadas como detectó la
        -- auditoría 2026-05-18 del batch innotest_guardia_civil).
        count(*) FILTER (WHERE
          (content_data->>'auto_classified_to') IS NOT NULL
          AND is_verified = false
        ) as psy_auto_classified
      FROM psychometric_questions
      WHERE is_active = true
    ),
    -- Psicotécnicas duplicadas: mismo texto + opciones (barajadas) + correct_option + image_url.
    -- Importante incluir image_url para evitar falsos positivos donde el enunciado y opciones
    -- son genéricas ("Observa la secuencia...", "Figura A/B/C/D") pero la imagen es distinta.
    psy_duplicate_count AS (
      SELECT COALESCE(SUM(cnt)::int, 0) as duplicates
      FROM (
        SELECT count(*) - 1 as cnt
        FROM psychometric_questions
        WHERE is_active = true
        GROUP BY question_text, correct_option, COALESCE(image_url, ''),
          (SELECT string_agg(opt, '|||' ORDER BY opt) FROM unnest(ARRAY[option_a, option_b, option_c, option_d]) AS opt)
        HAVING count(*) > 1
      ) d
    ),
    -- Psicotécnicas con tabla implícita: enunciados que asumen una tabla/gráfico pero
    -- el content_data está vacío. Heurística post-2026-05-18 para frases que no
    -- contienen frases delatoras directas (ya cubiertas por psy_figures).
    psy_implicit_table_count AS (
      SELECT count(*)::int as implicit_table
      FROM psychometric_questions
      WHERE is_active = true
        AND (
          question_text ILIKE '%entre las mujeres%'
          OR question_text ILIKE '%entre los hombres%'
          OR question_text ILIKE '%según la tabla%'
          OR question_text ILIKE '%según el gráfico%'
          OR question_text ILIKE '%según los datos%'
          OR question_text ILIKE '%según las tablas%'
          OR question_text ILIKE '%de la tabla%'
          OR question_text ILIKE '%del gráfico%'
          OR question_text ILIKE '%tabla adjunta%'
          OR question_text ILIKE '%gráfico adjunto%'
          OR question_text ILIKE '%de lunes a viernes%se recaud%'
          OR question_text ILIKE '%de lunes a%miércoles%se recaud%'
          OR question_text ILIKE '%se recaudó, entre%'
        )
        AND (
          content_data IS NULL
          OR content_data::text = '{}'
          OR (
            content_data->'table_data' IS NULL
            AND content_data->'tables' IS NULL
            AND content_data->'chart_data' IS NULL
            AND content_data->'categories' IS NULL
            AND content_data->'age_groups' IS NULL
          )
        )
        AND image_url IS NULL
    ),
    regional_wrong AS (
      SELECT count(*)::int as regional_mismatch
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE q.is_active = true
        AND l.scope != 'regional'
        AND l.name NOT ILIKE '%Estatuto de Autonomía%'
        AND (
          q.question_text ILIKE '%Decreto%Castilla y León%'
          OR q.question_text ILIKE '%Decreto%CyL%'
          OR q.question_text ILIKE '%Ley%Castilla y León%'
          OR q.question_text ILIKE '%Ley%CyL%'
          OR q.question_text ILIKE '%Decreto%Comunidad de Madrid%'
          OR q.question_text ILIKE '%Ley%Comunidad de Madrid%'
          OR q.question_text ILIKE '%Ley%Región de Murcia%'
          OR q.question_text ILIKE '%Ley%Principado de Asturias%'
          OR q.question_text ILIKE '%Decreto%Castilla-La Mancha%'
          OR q.question_text ILIKE '%Ley%Illes Balears%'
        )
    )
    SELECT (b.empty_options + b.banned_words + b.pending_explanation + b.missing_article + b.missing_image + b.excel_typo + b.html_explanation + b.cramped_explanation + b.outdated_plan + b.mismatched_answer + s.copied + dup.duplicates + wl.wrong_law + uc.uncited + pb.psy_empty + pb.psy_figures + pb.psy_html + pb.psy_auto_classified + psy_dup.duplicates + psy_imp.implicit_table + rw.regional_mismatch)::int as total
    FROM base b, similarity_count s, duplicate_count dup, wrong_law_count wl, uncited_count uc, psy_base pb, psy_duplicate_count psy_dup, psy_implicit_table_count psy_imp, regional_wrong rw
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
        AND (option_a = '' OR option_b = '' OR option_c = '' OR option_d = '' OR option_d = '')
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
        AND question_text NOT ILIKE '%Observatorio de la Imagen%'
        AND image_url IS NULL
        AND (content_data IS NULL OR content_data::text = '{}')
        AND id NOT IN (${sql.join(MISSING_IMAGE_REVIEWED_IDS.map(id => sql`${id}::uuid`), sql`, `)})
      LIMIT ${MAX_ITEMS}
    `),

    // 6. Excel function typos (e.g. SIERROR instead of SI.ERROR)
    // Exclude questions about LibreOffice Calc where SIERROR is the correct syntax
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             question_text as full_question_text,
             option_a, option_b, option_c, option_d,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d) ~* ${EXCEL_TYPO_REGEX}
        AND question_text NOT ILIKE '%Calc%'
        AND question_text NOT ILIKE '%LibreOffice%'
        AND question_text NOT ILIKE '%OpenOffice%'
      LIMIT ${MAX_ITEMS}
    `),

    // 7. HTML in explanation (should be markdown)
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND explanation ~* ${HTML_EXPLANATION_REGEX}
      LIMIT ${MAX_ITEMS}
    `),

    // 8. Wrong article law (question mentions app X but article is from law Y)
    // Must mirror the logic in runCountsOnly: exclude tech/informatics laws first
    db.execute(sql`
      SELECT q.id, LEFT(q.question_text, ${TEXT_LIMIT}) as question_text,
             l.short_name as law_name,
             count(*) OVER()::int as total_count
      FROM questions q
      JOIN articles a ON q.primary_article_id = a.id
      JOIN laws l ON a.law_id = l.id
      WHERE q.is_active = true AND (
        l.short_name NOT ILIKE '%Informática%'
        AND l.short_name NOT ILIKE '%Windows%'
        AND l.short_name NOT ILIKE '%Explorador%'
        AND l.short_name NOT ILIKE '%Red Internet%'
        AND l.short_name NOT ILIKE '%Correo%'
        AND l.short_name NOT ILIKE '%Microsoft 365%'
        AND l.short_name NOT ILIKE '%Word%'
        AND l.short_name NOT ILIKE '%Excel%'
        AND l.short_name NOT ILIKE '%Access%'
        AND l.short_name NOT ILIKE '%Outlook%'
        AND l.short_name NOT ILIKE '%OneDrive%'
        AND l.short_name NOT ILIKE '%Teams%'
        AND l.short_name NOT ILIKE '%SharePoint%'
        AND l.short_name NOT ILIKE '%hoja%'
        AND l.short_name NOT ILIKE '%procesador%'
        AND l.short_name NOT ILIKE '%Inglés%'
        AND l.short_name NOT ILIKE '%Ingles%'
        AND l.short_name NOT ILIKE '%English%'
        AND (
          q.question_text ~* '\\mAccess\\M'
          OR (q.question_text ~* '\\mExcel\\M' AND q.question_text !~* '\\mexcelencia\\M')
          OR (q.question_text ~* '\\mWord\\M' AND q.question_text !~* '\\mWordPress\\M')
          OR q.question_text ~* '\\mOutlook\\M'
          OR q.question_text ~* '\\mOneDrive\\M'
          OR q.question_text ~* '\\mTeams\\M'
          OR q.question_text ~* '\\mSharePoint\\M'
        )
      )
      LIMIT ${MAX_ITEMS}
    `),

    // 9. Cramped explanation (>400 chars without any line break)
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

    // 9. Duplicate questions (same text + same options + same article)
    // Preguntas con mismo texto pero artículos diferentes son legítimas (cross-oposicion).
    db.execute(sql`
      WITH dupe_groups AS (
        SELECT question_text, primary_article_id,
               (SELECT string_agg(opt, '|||' ORDER BY opt) FROM unnest(ARRAY[option_a, option_b, option_c, option_d]) AS opt) as options_sorted,
               count(*) as cnt
        FROM questions
        WHERE is_active = true
        GROUP BY question_text, primary_article_id,
          (SELECT string_agg(opt, '|||' ORDER BY opt) FROM unnest(ARRAY[option_a, option_b, option_c, option_d]) AS opt)
        HAVING count(*) > 1
      )
      SELECT DISTINCT ON (d.question_text, d.options_sorted, d.primary_article_id)
             q.id, LEFT(q.question_text, ${TEXT_LIMIT}) as question_text,
             d.cnt,
             (SELECT COALESCE(SUM(cnt - 1)::int, 0) FROM dupe_groups) as total_count
      FROM questions q
      JOIN dupe_groups d ON q.question_text = d.question_text
        AND (q.primary_article_id = d.primary_article_id OR (q.primary_article_id IS NULL AND d.primary_article_id IS NULL))
        AND (SELECT string_agg(opt, '|||' ORDER BY opt) FROM unnest(ARRAY[q.option_a, q.option_b, q.option_c, q.option_d]) AS opt) = d.options_sorted
      WHERE q.is_active = true
      ORDER BY d.question_text, d.options_sorted, d.primary_article_id, q.created_at ASC
      LIMIT ${MAX_ITEMS}
    `),

    // 11. Uncited explanation (legislative questions without article reference)
    db.execute(sql`
      SELECT q.id, LEFT(q.question_text, ${TEXT_LIMIT}) as question_text,
             LENGTH(q.explanation) as len,
             l.short_name as law_name,
             count(*) OVER()::int as total_count
      FROM questions q
      JOIN articles a ON q.primary_article_id = a.id
      JOIN laws l ON a.law_id = l.id
      WHERE q.is_active = true
        AND l.is_virtual IS NOT TRUE
        AND q.explanation IS NOT NULL
        AND LENGTH(q.explanation) > 20
        AND q.explanation NOT ILIKE '%pendiente de explicación%'
        AND q.explanation NOT ILIKE '%pendiente de explicacion%'
        AND q.explanation NOT LIKE '%>%'
        AND q.explanation !~* '(Art[íi]culo|\\mArt\\.)'
        AND a.article_number NOT IN ('0', '00', 'preámbulo', 'Preámbulo', 'General', 'Retos', 'I', 'II', 'III', 'IV')
      ORDER BY LENGTH(q.explanation) ASC
      LIMIT ${MAX_ITEMS}
    `),

    // 12. Outdated plans/strategies
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND CONCAT_WS(' ', question_text, option_a, option_b, option_c, option_d) ~* ${OUTDATED_PLAN_REGEX}
      LIMIT ${MAX_ITEMS}
    `),

    // 16. Mismatched answer (explanation says one letter but correct_option is different)
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             correct_option,
             upper(substring(explanation from ${MISMATCHED_ANSWER_REGEX})) as explanation_letter,
             count(*) OVER()::int as total_count
      FROM questions
      WHERE is_active = true
        AND explanation ~* ${MISMATCHED_ANSWER_REGEX}
        AND correct_option != CASE upper(substring(explanation from ${MISMATCHED_ANSWER_REGEX}))
          WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3
        END
      LIMIT ${MAX_ITEMS}
    `),

    // --- PSICOTÉCNICAS ---

    // 13. Opciones vacías en psicotécnicas
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM psychometric_questions
      WHERE is_active = true
        AND (option_a = '' OR option_b = '' OR option_c = '' OR option_d = '')
      LIMIT ${MAX_ITEMS}
    `),

    // 13. Psicotécnicas que referencian figuras/tablas pero no tienen content_data
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM psychometric_questions
      WHERE is_active = true
        AND (question_text ILIKE '%serie de figuras%' OR question_text ILIKE '%siguiente imagen%' OR question_text ILIKE '%siguiente gráfico%' OR question_text ILIKE '%tabla I y marcar%' OR question_text ILIKE '%observe la figura%' OR question_text ILIKE '%sustituya a la interrogaci%' OR question_text ILIKE '%sustituya al interrogante%' OR question_text ILIKE '%ocupe el lugar%')
        AND (content_data IS NULL OR content_data::text = '{}')
        AND image_url IS NULL
      LIMIT ${MAX_ITEMS}
    `),

    // 14. Explicación HTML en psicotécnicas
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM psychometric_questions
      WHERE is_active = true
        AND explanation ~* ${HTML_EXPLANATION_REGEX}
      LIMIT ${MAX_ITEMS}
    `),

    // 15. Preguntas sobre normas autonómicas vinculadas a leyes estatales
    db.execute(sql`
      SELECT q.id, LEFT(q.question_text, ${TEXT_LIMIT}) as question_text,
             l.short_name as linked_law,
             count(*) OVER()::int as total_count
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE q.is_active = true
        AND l.scope != 'regional'
        AND l.name NOT ILIKE '%Estatuto de Autonomía%'
        AND (
          q.question_text ILIKE '%Decreto%Castilla y León%'
          OR q.question_text ILIKE '%Decreto%CyL%'
          OR q.question_text ILIKE '%Ley%Castilla y León%'
          OR q.question_text ILIKE '%Ley%CyL%'
          OR q.question_text ILIKE '%Decreto%Comunidad de Madrid%'
          OR q.question_text ILIKE '%Ley%Comunidad de Madrid%'
          OR q.question_text ILIKE '%Ley%Región de Murcia%'
          OR q.question_text ILIKE '%Ley%Principado de Asturias%'
          OR q.question_text ILIKE '%Decreto%Castilla-La Mancha%'
          OR q.question_text ILIKE '%Ley%Illes Balears%'
        )
      LIMIT ${MAX_ITEMS}
    `),

    // 16. Psicotécnicas duplicadas: mismo texto + opciones + correct_option + image_url.
    // Incluir image_url evita falsos positivos para preguntas con enunciado genérico
    // ("Observa la secuencia...", "Figura A/B/C/D") cuya imagen es distinta.
    db.execute(sql`
      WITH psy_dupe_groups AS (
        SELECT question_text, correct_option, COALESCE(image_url, '') as img,
               (SELECT string_agg(opt, '|||' ORDER BY opt) FROM unnest(ARRAY[option_a, option_b, option_c, option_d]) AS opt) as options_sorted,
               count(*) as cnt
        FROM psychometric_questions
        WHERE is_active = true
        GROUP BY question_text, correct_option, COALESCE(image_url, ''),
          (SELECT string_agg(opt, '|||' ORDER BY opt) FROM unnest(ARRAY[option_a, option_b, option_c, option_d]) AS opt)
        HAVING count(*) > 1
      )
      SELECT DISTINCT ON (d.question_text, d.options_sorted, d.correct_option, d.img)
             q.id, LEFT(q.question_text, ${TEXT_LIMIT}) as question_text,
             d.cnt,
             (SELECT COALESCE(SUM(cnt - 1)::int, 0) FROM psy_dupe_groups) as total_count
      FROM psychometric_questions q
      JOIN psy_dupe_groups d ON q.question_text = d.question_text
        AND q.correct_option = d.correct_option
        AND COALESCE(q.image_url, '') = d.img
        AND (SELECT string_agg(opt, '|||' ORDER BY opt) FROM unnest(ARRAY[q.option_a, q.option_b, q.option_c, q.option_d]) AS opt) = d.options_sorted
      WHERE q.is_active = true
      ORDER BY d.question_text, d.options_sorted, d.correct_option, d.img, q.created_at ASC
      LIMIT ${MAX_ITEMS}
    `),

    // 17. Psicotécnicas con tabla implícita (enunciados que asumen tabla/gráfico
    // pero content_data está vacío, sin frase delatora — auditoría 2026-05-18).
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             count(*) OVER()::int as total_count
      FROM psychometric_questions
      WHERE is_active = true
        AND (
          question_text ILIKE '%entre las mujeres%'
          OR question_text ILIKE '%entre los hombres%'
          OR question_text ILIKE '%según la tabla%'
          OR question_text ILIKE '%según el gráfico%'
          OR question_text ILIKE '%según los datos%'
          OR question_text ILIKE '%según las tablas%'
          OR question_text ILIKE '%de la tabla%'
          OR question_text ILIKE '%del gráfico%'
          OR question_text ILIKE '%tabla adjunta%'
          OR question_text ILIKE '%gráfico adjunto%'
          OR question_text ILIKE '%de lunes a viernes%se recaud%'
          OR question_text ILIKE '%de lunes a%miércoles%se recaud%'
          OR question_text ILIKE '%se recaudó, entre%'
        )
        AND (
          content_data IS NULL
          OR content_data::text = '{}'
          OR (
            content_data->'table_data' IS NULL
            AND content_data->'tables' IS NULL
            AND content_data->'chart_data' IS NULL
            AND content_data->'categories' IS NULL
            AND content_data->'age_groups' IS NULL
          )
        )
        AND image_url IS NULL
      LIMIT ${MAX_ITEMS}
    `),

    // 18. Psicotécnicas auto-clasificadas no verificadas humanamente
    // (riesgo de mala clasificación — caso batch innotest_guardia_civil).
    db.execute(sql`
      SELECT id, LEFT(question_text, ${TEXT_LIMIT}) as question_text,
             (content_data->>'auto_classified_to') as auto_to,
             count(*) OVER()::int as total_count
      FROM psychometric_questions
      WHERE is_active = true
        AND (content_data->>'auto_classified_to') IS NOT NULL
        AND is_verified = false
      LIMIT ${MAX_ITEMS}
    `),
  ])

  const toRows = (r: any) => (r as any).rows ?? r ?? []

  const [emptyOpts, bannedRaw, pendingExpl, missingArt, missingImg, excelTypoRaw, htmlExplRaw, wrongLawRaw, crampedExplRaw, copiedExplRaw, duplicateRaw, uncitedRaw, outdatedPlanRaw, mismatchedRaw, psyEmptyRaw, psyFiguresRaw, psyHtmlRaw, regionalWrongRaw, psyDuplicateRaw, psyImplicitTableRaw, psyAutoClassifiedRaw] = results

  const emptyRows = toRows(emptyOpts)
  const bannedRows = toRows(bannedRaw)
  const pendingRows = toRows(pendingExpl)
  const missingRows = toRows(missingArt)
  const missingImgRows = toRows(missingImg)
  const excelTypoRows = toRows(excelTypoRaw)
  const htmlExplRows = toRows(htmlExplRaw)
  const wrongLawRows = toRows(wrongLawRaw)
  const crampedRows = toRows(crampedExplRaw)
  const copiedRows = toRows(copiedExplRaw)
  const duplicateRows = toRows(duplicateRaw)
  const uncitedRows = toRows(uncitedRaw)
  const outdatedPlanRows = toRows(outdatedPlanRaw)
  const mismatchedRows = toRows(mismatchedRaw)
  const psyEmptyRows = toRows(psyEmptyRaw)
  const psyFiguresRows = toRows(psyFiguresRaw)
  const psyHtmlRows = toRows(psyHtmlRaw)
  const regionalWrongRows = toRows(regionalWrongRaw)
  const psyDuplicateRows = toRows(psyDuplicateRaw)
  const psyImplicitTableRows = toRows(psyImplicitTableRaw)
  const psyAutoClassifiedRows = toRows(psyAutoClassifiedRaw)

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
    html_explanation: {
      count: getCount(htmlExplRows),
      questions: htmlExplRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'explanation',
      })),
    },
    wrong_article_law: {
      count: getCount(wrongLawRows),
      questions: wrongLawRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: q.law_name,
      })),
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
    uncited_explanation: {
      count: getCount(uncitedRows),
      questions: uncitedRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: q.law_name || `${q.len} chars`,
      })),
    },
    outdated_plan: {
      count: getCount(outdatedPlanRows),
      questions: outdatedPlanRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'plan obsoleto',
      })),
    },
    psy_empty_options: {
      count: getCount(psyEmptyRows),
      questions: psyEmptyRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'options',
      })),
    },
    psy_missing_figures: {
      count: getCount(psyFiguresRows),
      questions: psyFiguresRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'content_data',
      })),
    },
    psy_html_explanation: {
      count: getCount(psyHtmlRows),
      questions: psyHtmlRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'explanation',
      })),
    },
    psy_duplicate_questions: {
      count: getCount(psyDuplicateRows),
      questions: psyDuplicateRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: `${q.cnt} copias`,
      })),
    },
    psy_implicit_table: {
      count: getCount(psyImplicitTableRows),
      questions: psyImplicitTableRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'tabla implícita',
      })),
    },
    psy_auto_classified_unverified: {
      count: getCount(psyAutoClassifiedRows),
      questions: psyAutoClassifiedRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: q.auto_to || 'auto-clasificada',
      })),
    },
    regional_wrong_law: {
      count: getCount(regionalWrongRows),
      questions: regionalWrongRows.map((q: any) => ({
        id: q.id, question_text: q.question_text, field: 'primary_article_id',
        extra: q.linked_law,
      })),
    },
    mismatched_answer: {
      count: getCount(mismatchedRows),
      questions: mismatchedRows.map((q: any) => {
        const correctLetter = ['A', 'B', 'C', 'D'][q.correct_option] || '?'
        return {
          id: q.id, question_text: q.question_text,
          field: `dice ${q.explanation_letter}, correcta ${correctLetter}`,
        }
      }),
    },
  }

  const totalIssues =
    checks.empty_options.count +
    checks.banned_words.count +
    checks.pending_explanation.count +
    checks.missing_article.count +
    checks.missing_image.count +
    checks.excel_typo.count +
    checks.html_explanation.count +
    checks.wrong_article_law.count +
    checks.cramped_explanation.count +
    checks.copied_explanation.count +
    checks.duplicate_questions.count +
    checks.uncited_explanation.count +
    checks.outdated_plan.count +
    checks.psy_empty_options.count +
    checks.psy_missing_figures.count +
    checks.psy_html_explanation.count +
    checks.psy_duplicate_questions.count +
    checks.psy_implicit_table.count +
    checks.psy_auto_classified_unverified.count +
    checks.regional_wrong_law.count +
    checks.mismatched_answer.count

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
