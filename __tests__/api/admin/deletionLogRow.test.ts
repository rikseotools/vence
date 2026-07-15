/**
 * @jest-environment node
 */
// __tests__/api/admin/deletionLogRow.test.ts
//
// Capas del fix "el borrado de cuenta nunca completa" (bug 14/07/2026): la ruta
// DELETE /api/admin/delete-user llamaba a delete_user_account() SIN insertar antes
// la fila `deleted_users_log` que la función SQL EXIGE → fallaba siempre.
//
//  - UNIT (siempre): buildDeletionReason() es pura → se testea sin BD.
//  - INTEGRACIÓN (opt-in INTEGRATION_DB_WRITABLE=1): ensureDeletionLogRow() real
//    contra RDS con usuario DESECHABLE → inserta 1, es idempotente, y habilita que
//    delete_user_account() ya no lance "row is missing".
//
// Ambas importan las funciones REALES de producción (nunca copias).

import dotenv from 'dotenv'
import { Client } from 'pg'
dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
} else {
  // db/client crea el cliente postgres.js en el import leyendo DATABASE_URL; con un
  // dummy no conecta (postgres.js es lazy) → los tests unit (pura) siguen corriendo.
  process.env.DATABASE_URL = 'postgres://dummy:dummy@127.0.0.1:5432/dummy?sslmode=no-verify'
}
const DB_URL = process.env.DATABASE_URL
const REAL_DB = !!DB_URL && !DB_URL.includes('127.0.0.1:5432/dummy')
const canRunIntegration = REAL_DB && process.env.INTEGRATION_DB_WRITABLE === '1'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildDeletionReason, ensureDeletionLogRow } = require('@/lib/api/admin-delete-user')

describe('buildDeletionReason (unit, pura)', () => {
  const profile = {
    email: 'ana@example.com',
    fullName: 'Ana Pérez',
    planType: 'premium',
    targetOposicion: 'auxiliar_administrativo_estado',
    registeredAt: '2026-01-01T00:00:00.000Z',
  }

  it('incluye el snapshot del perfil y la base legal RGPD', () => {
    const r = buildDeletionReason(profile, { adminEmail: 'admin@vence.es', at: '2026-07-15T10:00:00.000Z' })
    expect(r).toContain('ana@example.com')
    expect(r).toContain('Ana Pérez')
    expect(r).toContain('premium')
    expect(r).toContain('auxiliar_administrativo_estado')
    expect(r).toContain('admin@vence.es')
    expect(r).toContain('2026-07-15T10:00:00.000Z')
    expect(r).toMatch(/RGPD Art\. ?17/)
    expect(r).toMatch(/Art\. ?12\.3/)
    expect(r.length).toBeGreaterThan(300)
  })

  it('degrada campos nulos a "n/d" sin romper', () => {
    const r = buildDeletionReason({ email: 'x@y.z', fullName: null, planType: null, targetOposicion: null, registeredAt: null })
    expect(r).toContain('x@y.z')
    expect(r).toContain('n/d')
    // sin adminEmail no debe colar "undefined"
    expect(r).not.toContain('undefined')
    expect(r).not.toContain(' por  el')
  })
})

const describeIntegration = canRunIntegration ? describe : describe.skip
describeIntegration('ensureDeletionLogRow (integración real contra RDS)', () => {
  jest.setTimeout(90000) // RDS + delete_user_account (cascada) puede tardar ~20-30s
  let pg: Client
  let uid: string
  const email = `test-ensurelog-${Date.now()}@vence-sim.invalid`

  beforeAll(async () => {
    pg = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await pg.connect()
    const r = await pg.query(
      `INSERT INTO user_profiles (id, email, full_name, plan_type, target_oposicion) VALUES (gen_random_uuid(), $1, 'Sim', 'free', 'auxiliar_administrativo_estado') RETURNING id`,
      [email]
    )
    uid = r.rows[0].id
  }, 90000)

  afterAll(async () => {
    if (pg) {
      try { await pg.query(`DELETE FROM deleted_users_log WHERE original_user_id = $1`, [uid]) } catch { /* noop */ }
      try { await pg.query(`DELETE FROM user_profiles WHERE id = $1`, [uid]) } catch { /* noop */ }
      await pg.end()
    }
  }, 90000)

  it('inserta la fila la 1ª vez, es idempotente la 2ª, y habilita delete_user_account', async () => {
    const first = await ensureDeletionLogRow(uid, { email, fullName: 'Sim', planType: 'free', targetOposicion: 'auxiliar_administrativo_estado', registeredAt: null }, { adminEmail: 'admin@vence.es' })
    expect(first.inserted).toBe(true)
    expect(first.existed).toBe(false)

    const second = await ensureDeletionLogRow(uid, { email }, {})
    expect(second.inserted).toBe(false)
    expect(second.existed).toBe(true)

    const count = (await pg.query(`SELECT COUNT(*)::int AS n FROM deleted_users_log WHERE original_user_id = $1`, [uid])).rows[0].n
    expect(count).toBe(1)

    // Con la fila presente, la fn SQL ya no lanza "row is missing".
    await expect(pg.query(`SELECT public.delete_user_account($1::uuid)`, [uid])).resolves.toBeDefined()
    const stillProfile = (await pg.query(`SELECT COUNT(*)::int AS n FROM user_profiles WHERE id = $1`, [uid])).rows[0].n
    expect(stillProfile).toBe(0)
    const log = (await pg.query(`SELECT email FROM deleted_users_log WHERE original_user_id = $1`, [uid])).rows[0]
    expect(log?.email).toBe(email) // email durable para el correo RGPD
  }, 90000)

  it('lanza si falta el email (fail-closed en el caller)', async () => {
    // @ts-expect-error probar el guard con email vacío
    await expect(ensureDeletionLogRow(uid, { email: '' }, {})).rejects.toThrow(/email requerido/)
  }, 30000)

  // Concurrencia: no hay unique index en original_user_id → dos borrados en paralelo del
  // MISMO userId podrían insertar 2 filas. El `pg_advisory_xact_lock` en ensureDeletionLogRow
  // los serializa → exactamente 1 fila. (Regresión del hallazgo MEDIUM de la revisión.)
  it('dos ensureDeletionLogRow concurrentes del mismo userId → 1 sola fila', async () => {
    const cEmail = `test-concur-${Date.now()}@vence-sim.invalid`
    const ins = await pg.query(
      `INSERT INTO user_profiles (id, email, full_name, plan_type, target_oposicion) VALUES (gen_random_uuid(), $1, 'Sim2', 'free', 'auxiliar_administrativo_estado') RETURNING id`,
      [cEmail]
    )
    const cuid = ins.rows[0].id
    try {
      const results = await Promise.all([
        ensureDeletionLogRow(cuid, { email: cEmail }, { adminEmail: 'admin@vence.es' }),
        ensureDeletionLogRow(cuid, { email: cEmail }, { adminEmail: 'admin@vence.es' }),
      ])
      // exactamente uno insertó, el otro vio la fila
      const insertedCount = results.filter(r => r.inserted).length
      expect(insertedCount).toBe(1)
      const n = (await pg.query(`SELECT COUNT(*)::int AS n FROM deleted_users_log WHERE original_user_id = $1`, [cuid])).rows[0].n
      expect(n).toBe(1)
    } finally {
      await pg.query(`DELETE FROM deleted_users_log WHERE original_user_id = $1`, [cuid])
      await pg.query(`DELETE FROM user_profiles WHERE id = $1`, [cuid])
    }
  }, 90000)
})
