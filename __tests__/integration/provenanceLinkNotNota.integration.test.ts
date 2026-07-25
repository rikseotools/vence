/**
 * @jest-environment node
 */
// __tests__/integration/provenanceLinkNotNota.integration.test.ts
//
// GUARDARRAÍL de provenance (T-107): ningún consumidor (epígrafe/hitos/señales) debe enlazar
// su source_documento_id a un documento tipo='nota' (snapshot de MONITOREO). Un consumidor
// referencia el documento OFICIAL canónico, no una nota. Nace del bug 25/07: ensure_convocatoria_
// documento no filtraba tipo → su SELECT por doc_key devolvía notas (las notas comparten doc_key)
// → 110 epígrafes + 4 hitos apuntaban a notas. Fix: la función filtra tipo<>'nota'. Este test
// (CI, prod read-only) falla si la regresión vuelve.
import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

describeIfDb('provenance — ningún consumidor enlaza a una nota de monitoreo', () => {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url)
  const sql = postgres(url, { ssl: local ? false : { rejectUnauthorized: false }, onnotice: () => {} })

  afterAll(async () => {
    await sql.end()
  })

  const CONSUMERS = ['topic_epigrafe_verification', 'convocatoria_hitos', 'oep_detection_signals']

  test.each(CONSUMERS)('%s no tiene source_documento_id → tipo=nota', async (table) => {
    const rows = await sql`
      SELECT count(*)::int AS n
      FROM ${sql(table)} x
      JOIN convocatoria_documentos cd ON cd.id = x.source_documento_id
      WHERE cd.tipo = 'nota'`
    expect(rows[0].n).toBe(0)
  })
})
