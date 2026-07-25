/**
 * @jest-environment node
 */
// __tests__/integration/temarioVersions.integration.test.ts
//
// GUARDARRAÍL Fase 1 de temario-versionado-por-convocatoria. Invariantes que deben mantenerse:
//  1. Cada oposición activa tiene EXACTAMENTE una temario_version `es_default`.
//  2. Ningún tema de una oposición activa se queda sin `temario_version_id` (todo temario
//     servible pertenece a una versión → position_type resuelve 1:1, serving intacto).
//  3. Toda convocatoria vigente de una oposición activa apunta a una versión.
// Corre en CI contra PROD read-only. Si algo rompe estos invariantes (una oposición nueva sin
// versión, dos defaults, un tema huérfano), falla el PR. Ver docs/roadmap/temario-versionado-por-convocatoria.md.
import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

describeIfDb('temario_versions — invariantes Fase 1 (RDS)', () => {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url)
  const sql = postgres(url, { ssl: local ? false : { rejectUnauthorized: false }, onnotice: () => {} })

  afterAll(async () => {
    await sql.end()
  })

  test('cada oposición activa tiene exactamente 1 temario_version default', async () => {
    // oposiciones activas con != 1 versión default
    const rows = await sql`
      SELECT o.slug, count(*) FILTER (WHERE tv.es_default) AS defaults
      FROM oposiciones o
      LEFT JOIN temario_versions tv ON tv.oposicion_id = o.id
      WHERE o.is_active
      GROUP BY o.slug
      HAVING count(*) FILTER (WHERE tv.es_default) <> 1`
    expect(rows.map((r) => r.slug)).toEqual([])
  })

  test('ningún tema de oposición activa sin temario_version_id', async () => {
    const rows = await sql`
      SELECT count(*)::int AS n
      FROM topics t
      JOIN oposiciones o ON o.is_active AND replace(o.slug,'-','_') = t.position_type
      WHERE t.is_active AND t.temario_version_id IS NULL`
    expect(rows[0].n).toBe(0)
  })

  test('toda convocatoria vigente de oposición activa apunta a una versión', async () => {
    const rows = await sql`
      SELECT count(*)::int AS n
      FROM convocatorias cv
      JOIN oposiciones o ON o.id = cv.oposicion_id AND o.is_active
      WHERE cv.is_current AND cv.temario_version_id IS NULL`
    expect(rows[0].n).toBe(0)
  })
})
