/** @jest-environment node */
// __tests__/integration/familiaClassification.test.ts
//
// Integración de la FAMILIA end-to-end contra la BD VIVA (RDS) vía pg:
//  1. la vista oposiciones_ssot EXPONE familia (los readers la reciben),
//  2. el CHECK rechaza valores fuera de la taxonomía cerrada,
//  3. CONSISTENCIA: classifyFamilia(nombre, administracion) === familia persistida
//     (garantiza que el backfill usó ESTE clasificador y no se ha desincronizado),
//  4. COBERTURA: las catalogadas mostrables (banner) tienen familia (pocos null).
//
// Lee de RDS. Skip si no hay DATABASE_URL (mismo patrón que configDbIntegrity).

import dotenv from 'dotenv'
import { Client } from 'pg'
import { classifyFamilia, FAMILIA_KEYS } from '@/lib/oposiciones/familia'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('Familia ↔ BD (integración)', () => {
  let client: Client
  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
  })
  afterAll(async () => { await client?.end() })

  it('la vista oposiciones_ssot expone la columna familia', async () => {
    const r = await client.query("SELECT familia FROM oposiciones_ssot LIMIT 1")
    expect(r.fields.some((f) => f.name === 'familia')).toBe(true)
  })

  it('el CHECK rechaza familia fuera de la taxonomía', async () => {
    await expect(
      client.query("UPDATE oposiciones SET familia='inventada' WHERE id=(SELECT id FROM oposiciones LIMIT 1)"),
    ).rejects.toThrow()
  })

  it('toda familia persistida es una clave válida de la taxonomía', async () => {
    const r = await client.query('SELECT DISTINCT familia FROM oposiciones WHERE familia IS NOT NULL')
    for (const row of r.rows) expect(FAMILIA_KEYS).toContain(row.familia)
  })

  it('CONSISTENCIA: el clasificador reproduce la familia persistida (muestra 300)', async () => {
    const r = await client.query(
      'SELECT nombre, administracion, familia FROM oposiciones WHERE familia IS NOT NULL ORDER BY id LIMIT 300',
    )
    const mismatches = r.rows.filter((o) => classifyFamilia(o.nombre, o.administracion) !== o.familia)
    if (mismatches.length) {
      console.log('mismatches (clasificador vs BD):', mismatches.slice(0, 5).map((m) => m.nombre))
    }
    // 0 = el backfill está sincronizado con el clasificador actual. Si falla, re-correr
    // scripts/backfill-familia.cjs (o revisar un cambio de keywords sin re-backfill).
    expect(mismatches).toHaveLength(0)
  })

  it('COBERTURA: ≥80% de catalogadas mostrables tienen familia (no otros/null)', async () => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
    const r = await client.query(
      `SELECT familia FROM oposiciones
       WHERE is_active = false AND seguimiento_url IS NOT NULL
         AND inscription_start::text <= $1 AND inscription_deadline::text >= $1`,
      [today],
    )
    const total = r.rows.length
    if (total === 0) return // no hay abiertas ahora → nada que cubrir
    const clasificadas = r.rows.filter((o) => o.familia && o.familia !== 'otros').length
    expect(clasificadas / total).toBeGreaterThanOrEqual(0.8)
  })
})
