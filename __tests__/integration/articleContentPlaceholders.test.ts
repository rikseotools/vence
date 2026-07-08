/**
 * @jest-environment node
 */
/**
 * Detecta artículos con contenido placeholder (texto genérico tipo
 * "Artículo X del Decreto..." en vez del contenido legal real).
 * Bug reportado por tatianacedenozamora@gmail.com (22/04/2026) —
 * 6 artículos del Decreto 69/2017 CM tenían placeholder desde su creación.
 *
 * Lee de la BD VIVA (RDS) vía pg. NO Supabase (congelado desde 04/07).
 */

import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

describe('Article content — no placeholders', () => {
  const runIf = hasDb ? it : it.skip
  let client: Client

  beforeAll(async () => {
    if (!hasDb) return
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })

  afterAll(async () => {
    await client?.end()
  })

  runIf('no articles start with "Artículo N del" (placeholder pattern)', async () => {
    // Placeholder = el contenido es la mera REFERENCIA al artículo ("Artículo 3
    // del Decreto...") en lugar del texto legal. Se detecta por el patrón al
    // inicio del contenido.
    // PERF: el prefiltro LIKE 'Artículo %' (barato) recorta el conjunto antes de
    // evaluar el regex — sin él, el regex se aplica a los ~54k artículos y bajo
    // la concurrencia del run completo supera el timeout. Todo placeholder
    // ("Artículo N del …") empieza por "Artículo ", así que el LIKE no descarta
    // ninguno.
    const { rows } = await client.query<{ article_number: string; ley: string }>(`
      SELECT a.article_number, l.short_name AS ley
      FROM articles a
      JOIN laws l ON l.id = a.law_id
      WHERE a.is_active = true
        AND a.content LIKE 'Art_culo %'
        AND a.content ~ '^Art[íi]culo\\s+[0-9]+\\s+(del|de la|de)\\b'
      ORDER BY l.short_name, a.article_number
      LIMIT 100
    `)

    if (rows.length > 0) {
      console.error(`\n❌ ${rows.length} artículos con contenido placeholder:`)
      for (const r of rows) console.error(`  Art. ${r.article_number} (${r.ley})`)
    }

    expect(rows).toHaveLength(0)
  }, 45000)
})
