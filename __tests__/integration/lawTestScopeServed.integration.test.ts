/**
 * @jest-environment node
 */
// __tests__/integration/lawTestScopeServed.integration.test.ts
//
// INTEGRACIÓN + SIMULACIÓN del fix T-073 contra RDS, por el camino REAL de serving,
// pasando selected_articles por el MISMO parser de producción (parseSelectedArticlesScope,
// el que usa LawTestPageWrapper) → NO se salta el hop URL→wrapper donde la review cazó
// la pérdida de los identificadores no-numéricos. Usa la fn REAL getFilteredQuestions
// (la que sirve /api/questions/filtered). NO reimplementa el filtro (sería copia).
//
// Cubre las DOS superficies:
//   (numérico) la petición ACOTADA sirve SOLO artículos del tema — NUNCA fuera de temario.
//   (NO numérico) round-trip de una DISPOSICIÓN ('1.3', '55 ter'…): el fix la sirve; el
//     parseInt anterior la truncaba y perdía sus preguntas (regresión que evita el fix).
import dotenv from 'dotenv'
import postgres from 'postgres'
import { getFilteredQuestions } from '@/lib/api/filtered-questions'
import { buildLawTestLink, parseSelectedArticlesScope } from '@/lib/navigation/backToArticleLink'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

// Simula el camino real cliente: buildLawTestLink → URLSearchParams(decode) → parser de prod.
function scopeThroughRealPath(lawSlug: string, scope: string[]): string[] {
  const url = buildLawTestLink(lawSlug, scope, 'temario')
  const decoded = new URL('https://x' + url).searchParams.get('selected_articles') // lo que ve LawTestPageWrapper
  return parseSelectedArticlesScope(decoded)
}

async function served(lawShortName: string, positionType: string, articleIds: string[]) {
  const res = await getFilteredQuestions({
    topicNumber: 0,
    positionType: positionType as never,
    numQuestions: 500,
    selectedLaws: [lawShortName],
    selectedArticlesByLaw: { [lawShortName]: articleIds },
    selectedSectionFilters: [],
    onlyOfficialQuestions: false,
  } as never)
  return res.questions as Array<{ id: string }>
}

// La respuesta FilteredQuestion NO expone article_number → resolvemos el artículo REAL de
// cada pregunta servida desde RDS (por primary_article_id). Verificación robusta del invariante.
async function articlesOfServed(sql: ReturnType<typeof postgres>, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const rows = await sql`
    SELECT DISTINCT a.article_number AS art
    FROM questions q JOIN articles a ON a.id = q.primary_article_id
    WHERE q.id = ANY(${ids}::uuid[])`
  return rows.map((r) => String(r.art))
}

describeIfDb('T-073 — el test de ley del temario respeta el scope (RDS, serving real + parser real)', () => {
  let sql: ReturnType<typeof postgres>
  let numFx: { positionType: string; scope: string[]; out: string } | null = null
  let dispFx: { positionType: string; lawShortName: string; article: string } | null = null

  beforeAll(async () => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } })

    // Fixture NUMÉRICO: tema que escopa CE a subconjunto + un artículo CE fuera del scope con preguntas.
    const ceRows = await sql`
      SELECT t.position_type, t.topic_number, ts.article_numbers AS scope
      FROM topics t JOIN topic_scope ts ON ts.topic_id = t.id JOIN laws l ON l.id = ts.law_id
      WHERE l.short_name = 'CE' AND t.is_active AND ts.article_numbers IS NOT NULL
        AND array_length(ts.article_numbers, 1) BETWEEN 5 AND 40
      ORDER BY t.position_type LIMIT 10`
    for (const r of ceRows) {
      const scope: string[] = (r.scope as string[]).map(String)
      const out = await sql`
        SELECT a.article_number FROM articles a JOIN questions q ON q.primary_article_id = a.id JOIN laws l ON l.id = a.law_id
        WHERE l.short_name = 'CE' AND q.is_active AND a.is_active
          AND a.article_number ~ '^[0-9]+$' AND NOT (a.article_number = ANY(${scope}))
        GROUP BY a.article_number ORDER BY count(q.id) DESC LIMIT 1`
      if (out.length) { numFx = { positionType: r.position_type as string, scope, out: out[0].article_number as string }; break }
    }

    // Fixture NO NUMÉRICO: tema que escopa una ley con un artículo NO numérico (disposición) con preguntas.
    const dispRows = await sql`
      SELECT t.position_type, l.short_name AS law, a.article_number AS art
      FROM topics t
      JOIN topic_scope ts ON ts.topic_id = t.id
      JOIN laws l ON l.id = ts.law_id
      JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(ts.article_numbers) AND a.is_active
      JOIN questions q ON q.primary_article_id = a.id AND q.is_active
      WHERE t.is_active AND ts.article_numbers IS NOT NULL AND a.article_number !~ '^[0-9]+$'
      GROUP BY t.position_type, l.short_name, a.article_number
      HAVING count(q.id) >= 3 ORDER BY count(q.id) DESC LIMIT 1`
    if (dispRows.length) dispFx = { positionType: dispRows[0].position_type as string, lawShortName: dispRows[0].law as string, article: dispRows[0].art as string }
  }, 120000)

  afterAll(async () => { if (sql) await sql.end() })

  test('fixtures reales encontrados (numérico + disposición)', () => {
    expect(numFx).not.toBeNull()
    expect(dispFx).not.toBeNull()
  })

  test('INTEGRACIÓN (round-trip real): la petición ACOTADA sirve SOLO artículos del tema', async () => {
    if (!numFx) return
    const ids = scopeThroughRealPath('constitucion-espanola', numFx.scope) // pasa por el parser de prod
    expect(new Set(ids)).toEqual(new Set(numFx.scope)) // el round-trip conserva el scope
    const qs = await served('CE', numFx.positionType, ids)
    expect(qs.length).toBeGreaterThan(0)
    // Artículo REAL de cada pregunta servida (desde RDS) — la respuesta no lo expone.
    const artsServed = await articlesOfServed(sql, qs.map((q) => q.id))
    const scopeSet = new Set(numFx.scope)
    const fuera = artsServed.filter((a) => !scopeSet.has(a))
    expect(fuera).toEqual([]) // NINGÚN artículo servido fuera del scope del tema
    expect(artsServed).not.toContain(numFx.out) // el sobre-servido del enlace pelado NO se cuela
  }, 120000)

  test('NO NUMÉRICO (regresión review): la disposición se SIRVE por el parser real, y el parseInt anterior la habría PERDIDO', async () => {
    if (!dispFx) return
    // El fix: parser real preserva el id → se sirven sus preguntas.
    const idsFix = scopeThroughRealPath('x-slug', [dispFx.article]) // slug irrelevante para el parse
    expect(idsFix).toEqual([dispFx.article])
    const servedFix = await served(dispFx.lawShortName, dispFx.positionType, idsFix)
    const artsFix = await articlesOfServed(sql, servedFix.map((q) => q.id))
    expect(servedFix.length).toBeGreaterThan(0) // ✅ el fix SÍ sirve la disposición
    expect(artsFix).toContain(dispFx.article) // …y son exactamente las de esa disposición
    expect(artsFix.every((a) => a === dispFx!.article)).toBe(true)

    // El bug anterior: parseInt('1.3')=1 / parseInt('55 ter')=55 → id equivocado (o NaN→vacío).
    const legacyParsed = [dispFx.article].map((a) => parseInt(a.trim(), 10)).filter((n) => !isNaN(n)).map(String)
    if (legacyParsed.length && legacyParsed[0] !== dispFx.article) {
      const servedLegacy = await served(dispFx.lawShortName, dispFx.positionType, legacyParsed)
      const artsLegacy = await articlesOfServed(sql, servedLegacy.map((q) => q.id))
      expect(artsLegacy).not.toContain(dispFx.article) // ❌ el parseInt anterior NO servía la disposición
    }
  }, 120000)
})
