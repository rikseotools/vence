// __tests__/integration/topicEpigrafeVerification.test.ts
// Invariantes del Sistema 2 (verificación de LITERALIDAD del epígrafe vs convocatoria)
// — migración 20260710_topic_epigrafe_verification.sql.
//   - record_epigrafe_verification() marca verified_literal / drift_detected / provisional_anterior
//   - cambiar el epígrafe invalida (state → 'stale') por trigger
//   - verdict inválido se rechaza
//   - la vista _effective deriva 'outdated_convocatoria' cuando el programa_last_hash cambia
// Tema aislado ('__verif_test_e__') + convocatoria+oposición aisladas → no toca datos reales.
// Escribe: requiere INTEGRATION_DB_WRITABLE.
import { Client } from 'pg'

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}
const DB_URL = process.env.DATABASE_URL
const WRITABLE = process.env.INTEGRATION_DB_WRITABLE === '1'
const describeIf = DB_URL && WRITABLE ? describe : describe.skip

describeIf('topic_epigrafe_verification — invariantes S2 (RDS, aislado)', () => {
  let c: Client
  let topicId: string
  let oposicionId: string
  let convId: string
  const PT = 'verif_test_e2'
  const SLUG = 'verif-test-e2' // = replace(PT, '_', '-') — así el join topics→oposiciones cuadra

  beforeAll(async () => {
    c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await c.connect()
    oposicionId = (await c.query(
      `INSERT INTO oposiciones (slug, nombre, tipo_acceso, administracion, is_active)
       VALUES ($1, 'Test S2', 'libre', 'test', true) RETURNING id`, [SLUG]
    )).rows[0].id
    convId = (await c.query(
      `INSERT INTO convocatorias (oposicion_id, año, is_current) VALUES ($1, 2026, true) RETURNING id`, [oposicionId]
    )).rows[0].id
    topicId = (await c.query(
      `INSERT INTO topics (position_type, topic_number, title, epigrafe, descripcion_corta, is_active)
       VALUES ($1, 1, 'Test', 'Epígrafe inicial', 'test', true) RETURNING id`, [PT]
    )).rows[0].id
  })

  afterAll(async () => {
    if (topicId) await c.query(`DELETE FROM topics WHERE id=$1`, [topicId])
    if (convId) await c.query(`DELETE FROM convocatorias WHERE id=$1`, [convId])
    if (oposicionId) await c.query(`DELETE FROM oposiciones WHERE id=$1`, [oposicionId])
    await c.end()
  })

  test('record marca verified_literal + escribe historial', async () => {
    await c.query(`SELECT record_epigrafe_verification($1,'literal',$2,'H1','{}'::jsonb,'multi_agent')`, [topicId, convId])
    const v = (await c.query(`SELECT state, source_convocatoria_id FROM topic_epigrafe_verification WHERE topic_id=$1`, [topicId])).rows[0]
    expect(v.state).toBe('verified_literal')
    expect(v.source_convocatoria_id).toBe(convId)
    const h = (await c.query(`SELECT count(*)::int n FROM topic_epigrafe_verification_history WHERE topic_id=$1`, [topicId])).rows[0].n
    expect(h).toBeGreaterThanOrEqual(1)
  })

  test('vista _effective = verified_literal cuando convocatoria y hashes cuadran', async () => {
    // convocatoria con programa_last_hash NULL → no marca outdated por hash; source coincide
    const e = (await c.query(`SELECT effective_state FROM topic_epigrafe_verification_effective WHERE topic_id=$1`, [topicId])).rows[0]
    expect(e.effective_state).toBe('verified_literal')
  })

  test('cambio de programa_last_hash en la convocatoria → outdated_convocatoria (vista)', async () => {
    await c.query(`UPDATE convocatorias SET programa_last_hash='H2' WHERE id=$1`, [convId]) // verificado con 'H1'
    const e = (await c.query(`SELECT effective_state FROM topic_epigrafe_verification_effective WHERE topic_id=$1`, [topicId])).rows[0]
    expect(e.effective_state).toBe('outdated_convocatoria')
    await c.query(`UPDATE convocatorias SET programa_last_hash=NULL WHERE id=$1`, [convId])
  })

  test('cambiar el epígrafe invalida → stale (trigger S2)', async () => {
    await c.query(`UPDATE topics SET epigrafe='Epígrafe cambiado' WHERE id=$1`, [topicId])
    const v = (await c.query(`SELECT state FROM topic_epigrafe_verification WHERE topic_id=$1`, [topicId])).rows[0]
    expect(v.state).toBe('stale')
  })

  test('drift verdict → drift_detected', async () => {
    await c.query(`SELECT record_epigrafe_verification($1,'drift',$2,'H1','{"motivo":"parafrasis"}'::jsonb,'multi_agent')`, [topicId, convId])
    const v = (await c.query(`SELECT state FROM topic_epigrafe_verification WHERE topic_id=$1`, [topicId])).rows[0]
    expect(v.state).toBe('drift_detected')
  })

  test('verdict inválido se rechaza', async () => {
    await expect(
      c.query(`SELECT record_epigrafe_verification($1,'literalisimo',$2,'H','{}'::jsonb,'x')`, [topicId, convId])
    ).rejects.toThrow()
  })
})
