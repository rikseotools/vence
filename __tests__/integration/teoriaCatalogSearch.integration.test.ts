/**
 * @jest-environment node
 *
 * Test de INTEGRACIÓN del catálogo de teoría (matview `mv_teoria_law_catalog`).
 *
 * NIVEL A (BD real, no destructivo): aplica la migración dentro de una
 * transacción y hace ROLLBACK → no persiste nada. Verifica:
 *   1. PARIDAD bit-a-bit: el conjunto {law_id, article_count} de la matview ==
 *      el que produce fetchLawsList() en JS (oráculo). Es el GUARDARRAÍL
 *      anti-drift: si alguien cambia las reglas de elegibilidad en JS y no en
 *      la matview (o viceversa), este test se pone rojo.
 *   2. BÚSQUEDA insensible a acentos/mayúsculas (pg_trgm + unaccent).
 *   3. PAGINACIÓN: páginas disjuntas y tamaños correctos.
 *
 * Usa `pg` directo (la connection string maneja sslmode=require). fetchLawsList
 * lee la BD viva vía Drizzle (tablas laws/articles, que la TX NO modifica), así
 * que el oráculo y la matview ven los mismos datos base.
 *
 * Si se salta: falta DATABASE_URL en .env.local.
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { Client } from 'pg'
import { fetchLawsList } from '@/lib/teoriaFetchers'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL
const d = hasDb ? describe : describe.skip

const MIGRATION = path.join(
  process.cwd(),
  'supabase/migrations/20260709_teoria_law_catalog_matview.sql'
)

d('Catálogo de teoría · matview + búsqueda (BD real, TX rollback)', () => {
  let client: Client

  beforeAll(async () => {
    // RDS presenta una cadena self-signed → verificación relajada (patrón del
    // proyecto post-cutover, memoria project_cutover_rds_prod).
    client = new Client({
      connectionString: (DB_URL as string).replace(/\?.*$/, ''),
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    await client.query('BEGIN')
    const sql = fs.readFileSync(MIGRATION, 'utf8')
    await client.query(sql)
  }, 60000)

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK').catch(() => {})
      await client.end().catch(() => {})
    }
  })

  it('PARIDAD: matview == fetchLawsList (mismo conjunto y article_count)', async () => {
    const mv = await client.query<{ law_id: string; article_count: number }>(
      'SELECT law_id, article_count FROM mv_teoria_law_catalog'
    )
    const oracle = await fetchLawsList()

    // Mismo tamaño
    expect(mv.rows.length).toBe(oracle.length)

    // Mismos IDs
    const mvIds = new Set(mv.rows.map((r) => r.law_id))
    const oracleIds = new Set(oracle.map((l) => l.id))
    expect(mvIds.size).toBe(oracleIds.size)
    for (const id of oracleIds) expect(mvIds.has(id)).toBe(true)

    // Mismo article_count por ley (bit-parity)
    const mvCount = new Map(mv.rows.map((r) => [r.law_id, Number(r.article_count)]))
    for (const l of oracle) {
      expect(mvCount.get(l.id)).toBe(l.articleCount)
    }
  }, 60000)

  it('BÚSQUEDA: "constitucion" (sin tilde) encuentra la Constitución', async () => {
    const r = await client.query<{ short_name: string }>(`
      SELECT short_name FROM mv_teoria_law_catalog
      WHERE search_text LIKE '%' || public.immutable_unaccent(lower($1)) || '%'
         OR search_text % public.immutable_unaccent(lower($1))
      ORDER BY similarity(search_text, public.immutable_unaccent(lower($1))) DESC,
               article_count DESC, short_name
      LIMIT 10
    `, ['constitucion'])
    const names = r.rows.map((x) => x.short_name)
    expect(names).toContain('CE')
  })

  it('BÚSQUEDA: tolera term parcial ("enjuiciamiento" → LECrim)', async () => {
    const r = await client.query<{ short_name: string }>(`
      SELECT short_name FROM mv_teoria_law_catalog
      WHERE search_text LIKE '%' || public.immutable_unaccent(lower($1)) || '%'
         OR search_text % public.immutable_unaccent(lower($1))
      ORDER BY similarity(search_text, public.immutable_unaccent(lower($1))) DESC
      LIMIT 10
    `, ['enjuiciamiento'])
    expect(r.rows.map((x) => x.short_name)).toContain('LECrim')
  })

  it('PAGINACIÓN: página 1 y 2 son disjuntas y del tamaño pedido', async () => {
    const pageSize = 48
    const p1 = await client.query<{ law_id: string }>(
      `SELECT law_id FROM mv_teoria_law_catalog ORDER BY article_count DESC, short_name LIMIT $1 OFFSET $2`,
      [pageSize, 0]
    )
    const p2 = await client.query<{ law_id: string }>(
      `SELECT law_id FROM mv_teoria_law_catalog ORDER BY article_count DESC, short_name LIMIT $1 OFFSET $2`,
      [pageSize, pageSize]
    )
    expect(p1.rows.length).toBe(pageSize)
    expect(p2.rows.length).toBe(pageSize)
    const s1 = new Set(p1.rows.map((r) => r.law_id))
    for (const r of p2.rows) expect(s1.has(r.law_id)).toBe(false)
  })
})
