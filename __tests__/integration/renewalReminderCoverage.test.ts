/** @jest-environment node */
// __tests__/integration/renewalReminderCoverage.test.ts
//
// Cobertura REAL de los recordatorios de renovación contra RDS (mismo criterio que
// scripts/canary-renewal-reminders.cjs, pero en CI): toda suscripción que renueva de
// forma inminente (48h), activa, sin cancelar y con ciclo maduro (>8 días) DEBE tener
// un `recordatorio_renovacion` en los últimos 9 días. Vigila el punto ciego que el
// heartbeat no ve: "el cron ticó pero envió 0". Skip si no hay DATABASE_URL.
import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('Cobertura de recordatorios de renovación (integración)', () => {
  let client: Client
  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
  })
  afterAll(async () => { await client?.end() })

  it('toda renovación inminente y madura tiene su recordatorio (últimos 9 días)', async () => {
    const { rows } = await client.query(`
      SELECT p.email
      FROM user_subscriptions s
      JOIN user_profiles p ON p.id = s.user_id
      WHERE s.status = 'active' AND s.cancel_at_period_end = false
        AND s.current_period_end >= now()
        AND s.current_period_end <  now() + interval '2 days'
        AND s.current_period_start <  now() - interval '8 days'
        AND NOT EXISTS (
          SELECT 1 FROM email_logs el
          WHERE el.user_id = s.user_id AND el.email_type = 'recordatorio_renovacion'
            AND el.sent_at > now() - interval '9 days'
        )`)
    if (rows.length) {
      console.log('renovaciones inminentes SIN recordatorio:', rows.map((r) => r.email))
    }
    expect(rows).toHaveLength(0)
  })
})
