/**
 * @jest-environment node
 *
 * Test de integración del MODELO de stats por tema (endpoint
 * /api/v2/topic-progress/theme-stats), contra prod (read-only) + endpoint en vivo.
 *
 * Codifica las invariantes que la V4 rompió (incidente 19/06), para que una
 * futura "optimización" que vuelva a estampar el tema en vez de derivarlo del
 * artículo→topic_scope falle aquí:
 *
 *   1. PROGRESO COMPLETO: el endpoint refleja ~todo el progreso en-scope del
 *      usuario (no solo el subconjunto etiquetado). V4 devolvía ~3%.
 *   2. MULTI-OPOSICIÓN: las mismas respuestas cuentan en otra oposición que
 *      comparte corpus legal (el artículo es la fuente de verdad).
 *
 * Se salta solo si faltan credenciales (CI sin secrets).
 */
import { Client } from 'pg'
import dotenv from 'dotenv'
import { getUserThemeStatsByOposicion } from '@/lib/api/theme-stats/queries'
import type { OposicionSlug } from '@/lib/api/theme-stats/schemas'

dotenv.config({ path: '.env.local' })

const DB_URL = process.env.DATABASE_URL

const maybe = DB_URL ? describe : describe.skip

// Redesign (08/07): antes pegaba a https://www.vence.es (prod) — frágil y ahora
// el endpoint exige auth (401). Testeamos la MISMA función que usa el endpoint
// (getUserThemeStatsByOposicion) contra la BD readonly: es donde vivía el bug V4
// y no depende de red/deploy/auth. El endpoint es un wrapper con auth+cache.
async function modelSum(userId: string, slug: string): Promise<{ ok: boolean; count: number; sum: number }> {
  const j = await getUserThemeStatsByOposicion(userId, slug as OposicionSlug)
  // La función devuelve `stats` como Record<topicNum, ThemeStat> (el endpoint es
  // un wrapper con auth+cache que reempaqueta). Sumamos el `total` de cada tema.
  const stats = j?.stats ? Object.values(j.stats) : []
  return {
    ok: !!j?.success,
    count: stats.length,
    sum: stats.reduce((a, s) => a + (Number(s.total) || 0), 0),
  }
}

maybe('Modelo de theme-stats (artículo→topic_scope) — invariantes anti-V4', () => {
  let client: Client
  let userId: string
  let positionType: string
  let expectedInScope: number

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    // Usuario más pesado con oposición activa.
    const u = await client.query(`
      SELECT uas.user_id::text AS user_id, up.target_oposicion AS pt
      FROM user_article_stats uas
      JOIN user_profiles up ON up.id = uas.user_id
      WHERE up.target_oposicion IN (SELECT DISTINCT position_type FROM topics WHERE is_active = true)
      GROUP BY uas.user_id, up.target_oposicion
      ORDER BY COUNT(*) DESC LIMIT 1
    `)
    userId = u.rows[0].user_id
    positionType = u.rows[0].pt
    // Total esperado en-scope (article→topic_scope) — la fuente de verdad.
    const e = await client.query(`
      WITH per_article AS (
        SELECT uas.article_id, SUM(uas.total_questions) AS total
        FROM user_article_stats uas WHERE uas.user_id = $1::uuid AND uas.article_id IS NOT NULL
        GROUP BY uas.article_id
      ),
      scope AS (
        SELECT DISTINCT a.id AS article_id FROM topics t
        JOIN topic_scope ts ON ts.topic_id = t.id
        JOIN articles a ON a.law_id = ts.law_id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        WHERE t.position_type = $2
      )
      SELECT COALESCE(SUM(pa.total),0)::int AS expected
      FROM per_article pa JOIN scope s ON s.article_id = pa.article_id
    `, [userId, positionType])
    expectedInScope = Number(e.rows[0].expected)
  }, 60000) // queries analíticas pesadas — margen bajo la concurrencia del run completo

  afterAll(async () => { if (client) await client.end() })

  it('1. el endpoint refleja el progreso COMPLETO en-scope (no oculta los tests globales)', async () => {
    expect(expectedInScope).toBeGreaterThan(200) // el user más pesado tiene mucho
    const slug = positionType.replace(/_/g, '-')
    const res = await modelSum(userId, slug)
    expect(res.ok).toBe(true)
    expect(res.count).toBeGreaterThan(0)
    // V4 devolvía << esperado; V5 debe reflejar ≥70% (margen para staleness de caché).
    expect(res.sum).toBeGreaterThanOrEqual(0.7 * expectedInScope)
  }, 30000)

  it('2. multi-oposición: las mismas respuestas cuentan en otra oposición con corpus común', async () => {
    // Buscar otra oposición activa que comparta ≥1 ley en la que el usuario ha
    // respondido (CE/L39/L40 son comunes a casi todas las administrativas).
    const other = await client.query(`
      WITH user_laws AS (
        SELECT DISTINCT a.law_id FROM user_article_stats uas
        JOIN articles a ON a.id = uas.article_id WHERE uas.user_id = $1::uuid
      )
      SELECT DISTINCT t.position_type
      FROM topics t JOIN topic_scope ts ON ts.topic_id = t.id
      WHERE t.is_active = true AND t.position_type <> $2
        AND ts.law_id IN (SELECT law_id FROM user_laws)
      LIMIT 1
    `, [userId, positionType])
    if (other.rows.length === 0) { return } // sin solape (raro) → nada que afirmar
    const otherSlug = other.rows[0].position_type.replace(/_/g, '-')
    const res = await modelSum(userId, otherSlug)
    expect(res.ok).toBe(true)
    // Sus respuestas en leyes comunes deben aparecer también en la otra oposición.
    expect(res.count).toBeGreaterThan(0)
    expect(res.sum).toBeGreaterThan(0)
  }, 30000)
})
