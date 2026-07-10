// __tests__/integration/topicScopeVerification.test.ts
// Verifica las invariantes del sistema de verificación de topic_scope
// (migración 20260710_topic_scope_verification.sql):
//   - compute_topic_scope_hash() es determinista y cambia al cambiar scope/epígrafe
//   - record_topic_verification() es la única vía de marcar verificado (rechaza verdict inválido)
//   - un cambio de scope/epígrafe invalida (state → 'stale') por trigger
//
// Usa un TEMA AISLADO (position_type '__verif_test__') creado y borrado en el
// propio test → no toca datos reales. Escribe, así que requiere INTEGRATION_DB_WRITABLE.
import { Client } from 'pg'

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}

const DB_URL = process.env.DATABASE_URL
const WRITABLE = process.env.INTEGRATION_DB_WRITABLE === '1'
const describeIf = DB_URL && WRITABLE ? describe : describe.skip

describeIf('topic_scope_verification — invariantes (RDS, escribe tema aislado)', () => {
  let c: Client
  let topicId: string
  let lawId: string

  beforeAll(async () => {
    c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await c.connect()
    // una ley cualquiera existente (solo la referenciamos en el scope de prueba)
    lawId = (await c.query(`SELECT id FROM laws LIMIT 1`)).rows[0].id
    // tema aislado
    topicId = (await c.query(
      `INSERT INTO topics (position_type, topic_number, title, epigrafe, descripcion_corta, is_active)
       VALUES ('__verif_test__', 1, 'Test verificación', 'Epígrafe de prueba inicial', 'test', true)
       RETURNING id`
    )).rows[0].id
    await c.query(
      `INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES ($1, $2, ARRAY['1','2','3'])`,
      [topicId, lawId]
    )
  })

  afterAll(async () => {
    if (topicId) await c.query(`DELETE FROM topics WHERE id = $1`, [topicId]) // cascade → scope + verification + history
    await c.end()
  })

  test('hash es determinista (misma entrada → mismo hash)', async () => {
    const h1 = (await c.query(`SELECT compute_topic_scope_hash($1) h`, [topicId])).rows[0].h
    const h2 = (await c.query(`SELECT compute_topic_scope_hash($1) h`, [topicId])).rows[0].h
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(32) // md5
  })

  test('record_topic_verification marca verified_correct + escribe historial', async () => {
    await c.query(`SELECT record_topic_verification($1,'correct','{"note":"ok"}'::jsonb,'run_test','multi_agent')`, [topicId])
    const v = (await c.query(`SELECT state, verdict, verified_scope_hash FROM topic_scope_verification WHERE topic_id=$1`, [topicId])).rows[0]
    expect(v.state).toBe('verified_correct')
    expect(v.verdict).toBe('correct')
    const live = (await c.query(`SELECT compute_topic_scope_hash($1) h`, [topicId])).rows[0].h
    expect(v.verified_scope_hash).toBe(live)
    const hist = (await c.query(`SELECT count(*)::int n FROM topic_scope_verification_history WHERE topic_id=$1`, [topicId])).rows[0].n
    expect(hist).toBeGreaterThanOrEqual(1)
  })

  test('cambiar el scope invalida → state = stale (trigger)', async () => {
    await c.query(`UPDATE topic_scope SET article_numbers = ARRAY['1','2','3','4'] WHERE topic_id=$1`, [topicId])
    const v = (await c.query(`SELECT state FROM topic_scope_verification WHERE topic_id=$1`, [topicId])).rows[0]
    expect(v.state).toBe('stale')
  })

  test('re-verificar tras el cambio vuelve a verified_correct con el nuevo hash', async () => {
    const before = (await c.query(`SELECT verified_scope_hash FROM topic_scope_verification WHERE topic_id=$1`, [topicId])).rows[0].verified_scope_hash
    await c.query(`SELECT record_topic_verification($1,'correct','{}'::jsonb,'run_test2','multi_agent')`, [topicId])
    const v = (await c.query(`SELECT state, verified_scope_hash FROM topic_scope_verification WHERE topic_id=$1`, [topicId])).rows[0]
    expect(v.state).toBe('verified_correct')
    expect(v.verified_scope_hash).not.toBe(before) // capturó el hash nuevo
  })

  test('cambiar el epígrafe invalida → stale (trigger sobre topics)', async () => {
    await c.query(`UPDATE topics SET epigrafe = 'Epígrafe cambiado' WHERE id=$1`, [topicId])
    const v = (await c.query(`SELECT state FROM topic_scope_verification WHERE topic_id=$1`, [topicId])).rows[0]
    expect(v.state).toBe('stale')
  })

  test('record_topic_verification rechaza verdict inválido', async () => {
    await expect(
      c.query(`SELECT record_topic_verification($1,'perfecto','{}'::jsonb,'run_x','multi_agent')`, [topicId])
    ).rejects.toThrow()
  })
})
