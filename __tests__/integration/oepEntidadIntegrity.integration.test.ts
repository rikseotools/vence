/**
 * @jest-environment node
 */
// __tests__/integration/oepEntidadIntegrity.integration.test.ts
//
// GUARDARRAÍL de la entidad OEP (T-108). Corre en CI contra PROD read-only. Verifica las
// invariantes que las FK no cubren:
//   1. Todo `oep.source_documento_id` apunta a un doc del hub con tipo='oep_decreto'.
//   2. El puente `convocatoria_oep` NUNCA cruza oposiciones (la convocatoria y la OEP son del
//      mismo cuerpo) — un cruce mezclaría plazas de oposiciones distintas.
//   3. Todo doc del hub con oep_id enlaza a una OEP que le apunta de vuelta (coherencia bidireccional).
// Nace de la integración F1/F3: el radar y el backfill escriben la entidad y clonan sus decretos.
import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

describeIfDb('OEP entidad — integridad (prod read-only)', () => {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url)
  const sql = postgres(url, { ssl: local ? false : { rejectUnauthorized: false }, onnotice: () => {} })

  afterAll(async () => {
    await sql.end()
  })

  test('source_documento_id siempre apunta a un doc tipo=oep_decreto', async () => {
    const rows = await sql`
      SELECT o.id FROM oep o
      JOIN convocatoria_documentos d ON d.id = o.source_documento_id
      WHERE d.tipo <> 'oep_decreto'`
    expect(rows.map((r) => r.id)).toEqual([])
  })

  test('convocatoria_oep NUNCA cruza oposiciones (misma oposición en ambos lados)', async () => {
    const rows = await sql`
      SELECT co.oep_id, co.convocatoria_id
      FROM convocatoria_oep co
      JOIN oep o ON o.id = co.oep_id
      JOIN convocatorias c ON c.id = co.convocatoria_id
      WHERE o.oposicion_id <> c.oposicion_id`
    expect(rows.map((r) => `${r.oep_id}→${r.convocatoria_id}`)).toEqual([])
  })

  test('todo doc del hub con oep_id enlaza a una OEP que le apunta de vuelta', async () => {
    const rows = await sql`
      SELECT d.id FROM convocatoria_documentos d
      WHERE d.oep_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM oep o WHERE o.id = d.oep_id AND o.source_documento_id = d.id)`
    expect(rows.map((r) => r.id)).toEqual([])
  })
})
