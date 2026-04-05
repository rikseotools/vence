/**
 * @jest-environment node
 */
// __tests__/integration/temarioDataQuality.test.ts
// Detecta anomalías de calidad en datos de temario. Usa SQL agregado (escalable).
// Corre sobre TODAS las oposiciones automáticamente.

import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

const describeIf = hasDb ? describe : describe.skip

describeIf('Calidad datos temario (escalable - todas las oposiciones)', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL! })
    await client.connect()
  }, 30000)

  afterAll(async () => {
    if (client) await client.end()
  })

  it('refs de topic_scope apuntan a artículos activos (tolerancia 350)', async () => {
    const { rows } = await client.query(`
      WITH refs AS (
        SELECT ts.topic_id, ts.law_id, unnest(ts.article_numbers) as article_num
        FROM topic_scope ts
        WHERE ts.law_id IS NOT NULL AND ts.article_numbers IS NOT NULL
      )
      SELECT COUNT(*) as broken
      FROM refs r
      LEFT JOIN articles a ON a.law_id = r.law_id AND a.article_number = r.article_num AND a.is_active = true
      WHERE a.id IS NULL
    `)
    const broken = parseInt(rows[0].broken)
    console.log(`topic_scope refs rotas: ${broken}`)
    expect(broken).toBeLessThan(350)
  })

  it('topics disponibles tienen preguntas asociadas', async () => {
    const { rows } = await client.query(`
      SELECT t.position_type, t.topic_number, t.title
      FROM topics t
      WHERE t.is_active = true AND t.disponible = true
        AND NOT EXISTS (
          SELECT 1
          FROM topic_scope ts
          JOIN articles a ON ts.law_id = a.law_id
            AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
          JOIN questions q ON q.primary_article_id = a.id
          WHERE ts.topic_id = t.id
            AND a.is_active = true
            AND q.is_active = true
          LIMIT 1
        )
      ORDER BY t.position_type, t.topic_number
    `)
    if (rows.length > 0) {
      console.error('\nTopics disponibles SIN preguntas:')
      for (const r of rows.slice(0, 15)) {
        console.error(`  ${r.position_type} T${r.topic_number}: ${r.title}`)
      }
    }
    expect(rows.length).toBeLessThan(15)
  })

  it('description es distinta del title', async () => {
    const { rows } = await client.query(`
      SELECT COUNT(*) as c FROM topics
      WHERE is_active = true AND description IS NOT NULL
        AND lower(trim(description)) = lower(trim(title))
    `)
    expect(parseInt(rows[0].c)).toBeLessThan(30)
  })

  it('description es más larga que title', async () => {
    const { rows } = await client.query(`
      SELECT COUNT(*) as c FROM topics
      WHERE is_active = true AND description IS NOT NULL
        AND length(description) < length(title)
    `)
    expect(parseInt(rows[0].c)).toBeLessThan(15)
  })

  it('topics con epigrafe tienen topic_scope', async () => {
    const { rows } = await client.query(`
      SELECT t.position_type, t.topic_number, t.title
      FROM topics t
      WHERE t.is_active = true AND t.disponible = true
        AND t.epigrafe IS NOT NULL AND length(t.epigrafe) > 30
        AND NOT EXISTS (SELECT 1 FROM topic_scope ts WHERE ts.topic_id = t.id)
    `)
    if (rows.length > 0) {
      console.warn('Topics con epigrafe pero sin topic_scope:')
      for (const r of rows.slice(0, 10)) console.warn(`  ${r.position_type} T${r.topic_number}`)
    }
    expect(rows.length).toBeLessThan(10)
  })

  it('integridad oposicion_bloques ↔ topics.bloque_number', async () => {
    const huerfanos1 = await client.query(`
      SELECT COUNT(*) as c FROM topics t
      WHERE t.is_active = true AND t.bloque_number IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM oposicion_bloques ob
          WHERE ob.position_type = t.position_type AND ob.bloque_number = t.bloque_number
        )
    `)
    expect(parseInt(huerfanos1.rows[0].c)).toBe(0)

    const huerfanos2 = await client.query(`
      SELECT COUNT(*) as c FROM oposicion_bloques ob
      WHERE NOT EXISTS (
        SELECT 1 FROM topics t
        WHERE t.position_type = ob.position_type AND t.bloque_number = ob.bloque_number AND t.is_active = true
      )
    `)
    expect(parseInt(huerfanos2.rows[0].c)).toBe(0)
  })

  it('reporte agregado de calidad', async () => {
    const { rows } = await client.query(`
      SELECT
        COUNT(DISTINCT position_type) as oposiciones,
        COUNT(*) as topics,
        COUNT(*) FILTER (WHERE description IS NULL) as sin_description,
        COUNT(*) FILTER (WHERE epigrafe IS NULL) as sin_epigrafe,
        COUNT(*) FILTER (WHERE bloque_number IS NULL) as sin_bloque,
        COUNT(*) FILTER (WHERE disponible = false) as no_disponibles,
        COUNT(*) FILTER (WHERE descripcion_corta IS NULL) as sin_desc_corta
      FROM topics WHERE is_active = true
    `)
    console.log('\n=== Reporte calidad ===')
    console.log(rows[0])
    expect(parseInt(rows[0].topics)).toBeGreaterThan(400)
  })
})
