/** @jest-environment node */
// __tests__/integration/essentialArticlesAvailability.test.ts
//
// Regresión del caso Pilar (2026-06-22). checkQuestionAvailability() alimenta el
// botón "Generar" del Test Aleatorio (RandomTestClient). ANTES ignoraba
// focusEssentialArticles → para una oposición SIN oficiales propios devolvía el
// pool completo (>0) → botón habilitado → la generación aplicaba el filtro
// estricto → 0 preguntas → pantalla "no puede generarlo".
//
// Tras el fix, con focus_essential la availability devuelve 0 para una oposición
// sin oficiales propios (botón deshabilitado), y sigue devolviendo el pool normal
// sin el filtro.
//
// La oposición del caso "→0" se DESCUBRE dinámicamente (position_type con
// preguntas pero 0 oficiales en scope) en vez de hardcodearla: así el test no se
// rompe cuando una oposición concreta recibe oficiales (le pasó a Administrativo
// CARM el 23/06, un día después de escribirse el test original).
//
// CI-safe: se salta si no hay DATABASE_URL.

import dotenv from 'dotenv'
import { Client } from 'pg'
import { checkQuestionAvailability } from '@/lib/api/random-test/queries'
import type { CheckAvailabilityRequest } from '@/lib/api/random-test/schemas'
import { SLUG_TO_POSITION_TYPE } from '@/lib/config/oposiciones'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

// position_type → slug (primer slug que mapea a ese position_type).
const POSITION_TYPE_TO_SLUG: Record<string, string> = {}
for (const [slug, pt] of Object.entries(SLUG_TO_POSITION_TYPE)) {
  if (!(pt in POSITION_TYPE_TO_SLUG)) POSITION_TYPE_TO_SLUG[pt as string] = slug
}

function req(slug: string, themes: number[], extra: Partial<CheckAvailabilityRequest>): CheckAvailabilityRequest {
  return {
    oposicion: slug,
    selectedThemes: themes,
    difficulty: 'mixed',
    onlyOfficialQuestions: false,
    includeSharedOfficials: false,
    focusEssentialArticles: false,
    userId: null,
    ...extra,
  } as CheckAvailabilityRequest
}

describeIfDb('checkQuestionAvailability honra focusEssentialArticles (caso Pilar)', () => {
  let client: Client
  let noOfficialsSlug: string | null = null
  let noOfficialsThemes: number[] = []

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()

    // Oposición SIN oficiales propios en su scope (escenario del caso Pilar).
    const cand = await client.query<{ position_type: string }>(`
      WITH scope_q AS (
        SELECT DISTINCT t.position_type, q.id AS qid, q.is_official_exam
        FROM topics t
        JOIN topic_scope ts ON ts.topic_id = t.id
        JOIN articles a ON a.law_id = ts.law_id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        JOIN questions q ON q.primary_article_id = a.id
        WHERE t.is_active = true AND t.disponible = true AND q.is_active = true
      )
      SELECT position_type
      FROM scope_q
      GROUP BY position_type
      HAVING count(*) FILTER (WHERE is_official_exam) = 0 AND count(*) > 100
      ORDER BY count(*) DESC
      LIMIT 1
    `)
    if (!cand.rows.length) return
    const pt = cand.rows[0].position_type
    noOfficialsSlug = POSITION_TYPE_TO_SLUG[pt] ?? null

    const themes = await client.query<{ topic_number: number }>(`
      SELECT DISTINCT t.topic_number
      FROM topics t
      JOIN topic_scope ts ON ts.topic_id = t.id
      JOIN articles a ON a.law_id = ts.law_id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      JOIN questions q ON q.primary_article_id = a.id
      WHERE t.position_type = $1 AND t.is_active = true AND t.disponible = true AND q.is_active = true
      ORDER BY t.topic_number
      LIMIT 8
    `, [pt])
    noOfficialsThemes = themes.rows.map((r) => r.topic_number)
  }, 30000)

  afterAll(async () => { await client?.end() })

  it('oposición sin oficiales propios + focus_essential → 0', async () => {
    expect(noOfficialsSlug).not.toBeNull()
    expect(noOfficialsThemes.length).toBeGreaterThan(0)
    const res = await checkQuestionAvailability(req(noOfficialsSlug!, noOfficialsThemes, { focusEssentialArticles: true }))
    expect(res.total).toBe(0)
  }, 30000)

  it('la misma oposición SIN focus_essential → > 0 (los temas sí tienen preguntas)', async () => {
    const res = await checkQuestionAvailability(req(noOfficialsSlug!, noOfficialsThemes, { focusEssentialArticles: false }))
    expect(res.total).toBeGreaterThan(0)
  }, 30000)

  it('control positivo: una oposición CON oficiales propios sí devuelve > 0 con focus_essential', async () => {
    // Auxiliar Administrativo del Estado tiene cientos de oficiales propios.
    // Escaneo robusto sin hardcodear estructura de temario.
    let found = 0
    for (const tema of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const res = await checkQuestionAvailability(req('auxiliar-administrativo-estado', [tema], { focusEssentialArticles: true }))
      if (res.total > 0) { found = res.total; break }
    }
    expect(found).toBeGreaterThan(0)
  }, 60000)
})
