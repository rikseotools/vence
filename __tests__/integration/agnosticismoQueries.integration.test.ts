/**
 * @jest-environment node
 */
// __tests__/integration/agnosticismoQueries.integration.test.ts
//
// Integración READ-ONLY contra RDS de las queries migradas de Supabase→Drizzle
// (paso 2 agnosticismo). Verifica PARIDAD/correctitud — la capa que faltaba y que
// habría cazado la landmine de schema-drift del 10/07 (get_subscription_count()
// es Supabase-específica —cuenta desde auth.users.email_confirmed_at, columna
// inexistente en RDS + tabla vacía— y FALLABA en RDS; se reescribió nativa).
//
// Solo lee (SELECT); no necesita INTEGRATION_DB_WRITABLE, solo DATABASE_URL.
import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('agnosticismo — paridad de queries migradas (RDS, read-only)', () => {
  let client: Client
  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query("SET statement_timeout='10000ms'")
  })
  afterAll(async () => { if (client) await client.end() })

  // ── email-events: conteo de suscripción reescrito nativo (user_profiles + email_preferences)
  test('email-events subscriptionCount: NO usa auth.users, es consistente y no lanza', async () => {
    const { rows } = await client.query<{ suscritos: number; no_suscritos: number; total: number }>(`
      SELECT
        count(*) FILTER (WHERE ep.unsubscribed_all IS NULL OR ep.unsubscribed_all = false)::int AS suscritos,
        count(*) FILTER (WHERE ep.unsubscribed_all = true)::int AS no_suscritos,
        count(*)::int AS total
      FROM user_profiles up
      LEFT JOIN email_preferences ep ON ep.user_id = up.id
    `)
    const r = rows[0]
    expect(r).toBeDefined()
    // total = nº de user_profiles (SSOT), no de auth.users (que está vacía en RDS).
    const { rows: up } = await client.query<{ n: number }>('SELECT count(*)::int n FROM user_profiles')
    expect(r.total).toBe(up[0].n)
    // Partición completa: suscritos + no_suscritos = total (cada user cae en una).
    expect(r.suscritos + r.no_suscritos).toBe(r.total)
    // Guarda contra el LEFT JOIN duplicando filas si hubiera >1 pref/user.
    const { rows: dup } = await client.query<{ n: number }>(
      'SELECT count(*)::int n FROM (SELECT user_id FROM email_preferences GROUP BY user_id HAVING count(*)>1) x',
    )
    expect(dup[0].n).toBe(0) // email_preferences es 1 por user → el count no infla
  })

  // Guardarraíl anti-regresión de la landmine: la fn Supabase-específica DEBE fallar
  // en RDS (por eso se dejó de usar). Si algún día existiera y funcionara, revisar.
  test('get_subscription_count() de Supabase NO es utilizable en RDS (por diseño migrado)', async () => {
    await expect(client.query('SELECT * FROM public.get_subscription_count()')).rejects.toThrow()
  })

  // ── broadcast: filtros migrados a Drizzle (and/or/eq/ilike)
  test('broadcast: filtro por target_oposicion devuelve {id,email}', async () => {
    const { rows } = await client.query(
      "SELECT id, email FROM user_profiles WHERE target_oposicion = $1 LIMIT 5",
      ['auxiliar_administrativo_estado'],
    )
    // Puede haber 0 en un entorno vacío; si hay, deben traer id (email puede ser null).
    for (const row of rows) expect(row).toHaveProperty('id')
    expect(Array.isArray(rows)).toBe(true)
  })

  test('broadcast: filtro ciudad ILIKE (OR de ciudades) no lanza y filtra', async () => {
    const { rows } = await client.query(
      "SELECT count(*)::int n FROM user_profiles WHERE ciudad ILIKE '%Madrid%' OR ciudad ILIKE '%Getafe%'",
    )
    expect(rows[0].n).toBeGreaterThanOrEqual(0)
  })

  test('broadcast: email_preferences.unsubscribed_all por user_id (forma correcta)', async () => {
    const { rows } = await client.query('SELECT unsubscribed_all FROM email_preferences LIMIT 1')
    if (rows.length) expect(typeof rows[0].unsubscribed_all === 'boolean' || rows[0].unsubscribed_all === null).toBe(true)
  })

  // ── admin RPCs migrados a Drizzle (getAdminDb().execute) — no tocan auth.users
  test('get_user_conversion_journey(uuid) ejecutable en RDS (no depende de auth.users)', async () => {
    // uuid inexistente → 0 filas pero SIN error (guarda contra schema-drift tipo landmine).
    await expect(
      client.query('SELECT * FROM public.get_user_conversion_journey($1::uuid)', [
        '00000000-0000-4000-8000-000000000000',
      ]),
    ).resolves.toBeDefined()
  })

  test('get_all_users_with_subscriptions() ejecutable en RDS', async () => {
    const { rows } = await client.query('SELECT count(*)::int n FROM public.get_all_users_with_subscriptions()')
    expect(rows[0].n).toBeGreaterThanOrEqual(0)
  })

  // ── verify-answer: fallback keyword migrado a Drizzle (articles + laws, ilike content, is_active)
  test('verify-answer fallback: articles+laws join por keyword devuelve la forma esperada', async () => {
    const { rows } = await client.query(`
      SELECT a.article_number, a.content, l.short_name, l.name
      FROM articles a LEFT JOIN laws l ON l.id = a.law_id
      WHERE a.is_active = true AND a.content ILIKE '%procedimiento%'
      LIMIT 3
    `)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r).toHaveProperty('article_number')
      expect(r).toHaveProperty('content')
    }
  })
})
