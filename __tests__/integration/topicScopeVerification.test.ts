/**
 * @jest-environment node
 *
 * ⚠️ `node`, NO el jsdom por defecto (T-518, 06/08/2026). Los casos del badge llaman a
 * `getScopeVerificationCount()`, que va por `getAdminDb()` → cliente `postgres` (porsager), y
 * ese cliente usa `setImmediate`/`clearImmediate`, que jsdom NO define: los dos tests nuevos
 * reventaban con `ReferenceError: setImmediate is not defined` ANTES de comprobar nada. Los
 * otros seis pasaban porque hablan con RDS por `pg`, así que la suite parecía sana y lo único
 * sin ejecutar era justo lo que este fichero venía a probar.
 */
// __tests__/integration/topicScopeVerification.test.ts
// Verifica las invariantes del sistema de verificación de topic_scope
// (migración 20260710_topic_scope_verification.sql):
//   - compute_topic_scope_hash() es determinista y cambia al cambiar scope/epígrafe
//   - record_topic_verification() es la única vía de marcar verificado (rechaza verdict inválido)
//   - un cambio de scope/epígrafe invalida (state → 'stale') por trigger
//
// Usa un TEMA AISLADO (position_type '__verif_test__') creado y borrado en el
// propio test → no toca datos reales. Escribe, así que requiere INTEGRATION_DB_WRITABLE.
import { testDbConfig } from '../helpers/db'
import { Client } from 'pg'
import { getScopeVerificationCount } from '@/lib/api/scope-verification/queries'

// ⚠️ NO se toca `process.env.DATABASE_URL` (T-518, 06/08/2026). Antes se reescribía a
// `sslmode=no-verify` "para que conecte", y esa mutación la hereda TODO el que conecte después
// —incluido `getScopeVerificationCount()`, que va por `getAdminDb()` → cliente `postgres`—:
// ese cliente no entiende `no-verify`, sigue verificando la CA privada de RDS y muere con
// `self-signed certificate in certificate chain`. Resultado: los dos únicos casos que prueban
// lo NUEVO fallaban por la conexión mientras los otros seis pasaban (hablan por `pg`, que sí
// entiende `no-verify`), así que la suite parecía sana y lo que este fichero venía a comprobar
// no se ejecutaba nunca.
//
// Y arrancarle el `sslmode` del todo TAMPOCO vale, aunque sea la receta para `pg`: `db/client.ts`
// NO pasa opción `ssl` —depende del `sslmode` de la cadena—, así que sin él el cliente de la app
// intenta conectar en claro y RDS lo rechaza. La única salida buena es dejar la URL en paz: el
// cliente `pg` de este test ya resuelve lo suyo dentro de `testDbConfig`, sin tocar el entorno.

const DB_URL = process.env.DATABASE_URL
const WRITABLE = process.env.INTEGRATION_DB_WRITABLE === '1'
const describeIf = DB_URL && WRITABLE ? describe : describe.skip

describeIf('topic_scope_verification — invariantes (RDS, escribe tema aislado)', () => {
  let c: Client
  let topicId: string
  let lawId: string

  beforeAll(async () => {
    c = new Client(testDbConfig())
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

  // T-518: el sellado directo del 20-21/07 dejó 881 temas `verified_correct` sin haber pasado
  // por el pipeline (`verified_by='claude_direct'` o `agent_run_id` vacío/`--run`, el nombre del
  // flag mal pasado como valor). El badge de `/admin` los contaba como "resuelto" igual que un
  // veredicto real de `verify:scope`. Estos dos tests prueban la función REAL del badge
  // (`getScopeVerificationCount`, no una copia) contra un tema aislado.
  describe('T-518 — el badge no puede contar un verified_correct sin pipeline como resuelto', () => {
    test('sellado con agent_run_id="--run" (el flag mal pasado) cuenta como pendiente', async () => {
      const antes = await getScopeVerificationCount()
      if (!antes.success) throw new Error(antes.error)

      await c.query(`SELECT record_topic_verification($1,'correct','{}'::jsonb,'--run','claude_direct')`, [topicId])
      const conSelloRoto = await getScopeVerificationCount()
      if (!conSelloRoto.success) throw new Error(conSelloRoto.error)
      expect(conSelloRoto.scopeSinPipeline).toBe(antes.scopeSinPipeline + 1)
      expect(conSelloRoto.scope).toBe(antes.scope + 1)
      expect(conSelloRoto.count).toBe(antes.count + 1)

      // el mismo tema, sellado por el pipeline de verdad con un run_id que sí identifica una
      // corrida → dejar de contar como deuda
      await c.query(`SELECT record_topic_verification($1,'correct','{}'::jsonb,'verify_test_2026-08-05','multi_agent')`, [topicId])
      const conSelloBueno = await getScopeVerificationCount()
      if (!conSelloBueno.success) throw new Error(conSelloBueno.error)
      expect(conSelloBueno.scopeSinPipeline).toBe(antes.scopeSinPipeline)
      expect(conSelloBueno.scope).toBe(antes.scope)
    })

    test('agent_run_id vacío también cuenta como pendiente, venga o no de claude_direct', async () => {
      const antes = await getScopeVerificationCount()
      if (!antes.success) throw new Error(antes.error)

      // 'multi_agent' es el escritor legítimo del pipeline — el defecto es el run_id vacío,
      // no el nombre del escritor (así se vieron los 175 casos reales de multi_agent+--run).
      await c.query(`SELECT record_topic_verification($1,'correct','{}'::jsonb,'','multi_agent')`, [topicId])
      const con = await getScopeVerificationCount()
      if (!con.success) throw new Error(con.error)
      expect(con.scopeSinPipeline).toBe(antes.scopeSinPipeline + 1)
    })
  })
})
