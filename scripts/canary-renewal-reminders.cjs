#!/usr/bin/env node
// scripts/canary-renewal-reminders.cjs
//
// CANARY de cobertura de los recordatorios de renovación (contra RDS). Vigila lo que
// el heartbeat NO ve: que los recordatorios REALMENTE SALEN, no solo que el cron ticó.
//
// Punto ciego que cubre: el cron puede disparar (2xx) y enviar 0 (query mala, dedup
// roto, Resend caído) → heartbeat verde, usuarios cobrados sin aviso → bajas/reembolsos.
//
// Regla: toda suscripción que renueva de forma INMINENTE (próximas 48h), activa, sin
// cancelar y cuyo periodo empezó hace >8 días (así el recordatorio de 7d ya debía
// haber salido dentro de este ciclo), DEBE tener un `recordatorio_renovacion` en
// email_logs en los últimos 9 días. Si alguna no lo tiene → FALLO (exit 1).
//
// Uso:  node scripts/canary-renewal-reminders.cjs   (DATABASE_URL en .env.local)

const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const { rows } = await c.query(`
      SELECT p.email, s.current_period_end::date AS renov,
        EXISTS (
          SELECT 1 FROM email_logs el
          WHERE el.user_id = s.user_id
            AND el.email_type = 'recordatorio_renovacion'
            AND el.sent_at > now() - interval '9 days'
        ) AS avisado
      FROM user_subscriptions s
      JOIN user_profiles p ON p.id = s.user_id
      WHERE s.status = 'active'
        AND s.cancel_at_period_end = false
        AND s.current_period_end >= now()
        AND s.current_period_end <  now() + interval '2 days'      -- renovación inminente
        AND s.current_period_start <  now() - interval '8 days'    -- ciclo maduro (el 7d ya debía salir)
      ORDER BY s.current_period_end
    `)

    const sinAvisar = rows.filter((r) => !r.avisado)
    console.log(`renovaciones inminentes (48h) maduras: ${rows.length} · con recordatorio: ${rows.length - sinAvisar.length}`)

    if (sinAvisar.length > 0) {
      console.error(`❌ CANARY renewal-reminders FALLA: ${sinAvisar.length} renovación(es) inminente(s) SIN recordatorio:`)
      sinAvisar.forEach((r) => console.error(`   - ${r.email} renueva ${r.renov.toISOString().slice(0, 10)}`))
      process.exit(1)
    }
    console.log('✅ CANARY renewal-reminders OK (toda renovación inminente tiene su aviso)')
  } finally {
    await c.end()
  }
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
