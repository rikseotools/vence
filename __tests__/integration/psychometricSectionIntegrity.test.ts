/**
 * @jest-environment node
 */
// Test de integridad: las preguntas psicotécnicas deben tener section_id
// y la suma de secciones debe cuadrar con el total de cada categoría.
//
// Bug original: 3089 preguntas sin section_id causaban que la página
// mostrara totales por categoría que no cuadraban con las subcategorías.

import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

const describeIf = hasDb ? describe : describe.skip

describeIf('Psicotécnicas — Integridad de secciones', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })

  afterAll(async () => {
    await client.end()
  })

  it('NO debe haber preguntas activas sin section_id', async () => {
    const { rows } = await client.query(`
      SELECT count(*) as cnt
      FROM psychometric_questions
      WHERE is_active = true AND section_id IS NULL
    `)
    const count = parseInt(rows[0].cnt)
    if (count > 0) {
      console.error(`${count} preguntas psicotécnicas activas sin section_id`)
    }
    expect(count).toBe(0)
  })

  it('la suma de secciones debe cuadrar con el total de cada categoría', async () => {
    const { rows } = await client.query(`
      SELECT
        c.display_name,
        (SELECT count(*) FROM psychometric_questions q WHERE q.category_id = c.id AND q.is_active = true) as cat_total,
        (SELECT coalesce(sum(sec_count), 0) FROM (
          SELECT count(*) as sec_count
          FROM psychometric_questions q2
          INNER JOIN psychometric_sections s ON q2.section_id = s.id
          WHERE s.category_id = c.id AND q2.is_active = true
          GROUP BY q2.section_id
        ) sub) as sec_sum
      FROM psychometric_categories c
      WHERE c.is_active = true
    `)

    for (const row of rows) {
      const catTotal = parseInt(row.cat_total)
      const secSum = parseInt(row.sec_sum)
      if (catTotal !== secSum) {
        console.error(`MISMATCH ${row.display_name}: categoría=${catTotal} secciones=${secSum}`)
      }
      expect(secSum).toBe(catTotal)
    }
  })

  it('NO debe haber preguntas con section de otra categoría', async () => {
    const { rows } = await client.query(`
      SELECT count(*) as cnt
      FROM psychometric_questions q
      INNER JOIN psychometric_sections s ON q.section_id = s.id
      WHERE q.is_active = true AND s.category_id != q.category_id
    `)
    const count = parseInt(rows[0].cnt)
    if (count > 0) {
      console.error(`${count} preguntas con section_id de otra categoría`)
    }
    expect(count).toBe(0)
  })
})
