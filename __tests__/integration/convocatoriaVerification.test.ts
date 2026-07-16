// __tests__/integration/convocatoriaVerification.test.ts
// Invariantes de convocatoria_verification (verificación del PROCESO vs documento oficial)
// — migración 20260716_convocatoria_verification.sql.
//   - record_convocatoria_verification() marca verified_correct / verified_issues / needs_human
//   - captura el hash del dato PROPIO internamente (== compute_convocatoria_hash en vivo)
//   - cambiar un campo de proceso invalida (state → 'stale') por trigger
//   - re-verificar tras el cambio vuelve a verified_correct con hash NUEVO
//   - verdict inválido se rechaza
//   - la vista _effective devuelve 'never_verified' cuando no hay fila
// Oposición+convocatoria aisladas → no toca datos reales. Requiere INTEGRATION_DB_WRITABLE.
import { Client } from 'pg'

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}
const DB_URL = process.env.DATABASE_URL
const WRITABLE = process.env.INTEGRATION_DB_WRITABLE === '1'
const describeIf = DB_URL && WRITABLE ? describe : describe.skip

describeIf('convocatoria_verification — invariantes (RDS, aislado)', () => {
  let c: Client
  let oposicionId: string
  let convId: string
  const SLUG = 'verif-test-conv'

  beforeAll(async () => {
    c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await c.connect()
    oposicionId = (await c.query(
      `INSERT INTO oposiciones (slug, nombre, tipo_acceso, administracion, is_active)
       VALUES ($1, 'Test Conv Verif', 'libre', 'test', true) RETURNING id`, [SLUG]
    )).rows[0].id
    convId = (await c.query(
      `INSERT INTO convocatorias (oposicion_id, año, is_current, exam_date, exam_date_approximate, plazas_libres, estado_proceso)
       VALUES ($1, 2026, true, '2027-05-01', true, 107, 'inscripcion_abierta') RETURNING id`, [oposicionId]
    )).rows[0].id
  })

  afterAll(async () => {
    if (convId) await c.query(`DELETE FROM convocatorias WHERE id=$1`, [convId])
    if (oposicionId) await c.query(`DELETE FROM oposiciones WHERE id=$1`, [oposicionId])
    await c.end()
  })

  const record = (verdict: string, snippet = 'base 9: mayo de 2027') =>
    c.query(
      `SELECT record_convocatoria_verification($1,$2,'{}'::jsonb,'http://boe/x',$3,'SRCHASH','run1','claude')`,
      [convId, verdict, snippet]
    )

  test('hash determinista (32 chars, mismo valor)', async () => {
    const h1 = (await c.query(`SELECT compute_convocatoria_hash($1) h`, [convId])).rows[0].h
    const h2 = (await c.query(`SELECT compute_convocatoria_hash($1) h`, [convId])).rows[0].h
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(32)
  })

  test('la vista _effective = never_verified antes de verificar', async () => {
    const e = (await c.query(`SELECT effective_state FROM convocatoria_verification_effective WHERE convocatoria_id=$1`, [convId])).rows[0]
    expect(e.effective_state).toBe('never_verified')
  })

  test('record correct → verified_correct + historial + hash cuadra con el vivo', async () => {
    await record('correct')
    const v = (await c.query(
      `SELECT state, verdict, verified_data_hash, verified_data_hash = compute_convocatoria_hash($1) AS hash_ok
       FROM convocatoria_verification WHERE convocatoria_id=$1`, [convId])).rows[0]
    expect(v.state).toBe('verified_correct')
    expect(v.verdict).toBe('correct')
    expect(v.hash_ok).toBe(true)
    const h = (await c.query(`SELECT count(*)::int n FROM convocatoria_verification_history WHERE convocatoria_id=$1`, [convId])).rows[0].n
    expect(h).toBeGreaterThanOrEqual(1)
    const e = (await c.query(`SELECT effective_state FROM convocatoria_verification_effective WHERE convocatoria_id=$1`, [convId])).rows[0]
    expect(e.effective_state).toBe('verified_correct')
  })

  test('cambiar un campo de proceso (exam_date) invalida → stale (trigger)', async () => {
    await c.query(`UPDATE convocatorias SET exam_date='2027-06-01' WHERE id=$1`, [convId])
    const v = (await c.query(`SELECT state FROM convocatoria_verification WHERE convocatoria_id=$1`, [convId])).rows[0]
    expect(v.state).toBe('stale')
  })

  test('re-verificar tras el cambio → verified_correct con hash NUEVO', async () => {
    const prev = (await c.query(`SELECT verified_data_hash h FROM convocatoria_verification WHERE convocatoria_id=$1`, [convId])).rows[0].h
    await record('correct')
    const v = (await c.query(`SELECT state, verified_data_hash h FROM convocatoria_verification WHERE convocatoria_id=$1`, [convId])).rows[0]
    expect(v.state).toBe('verified_correct')
    expect(v.h).not.toBe(prev)
  })

  test('verdict inválido se rechaza', async () => {
    await expect(record('correctisimo')).rejects.toThrow()
  })
})
