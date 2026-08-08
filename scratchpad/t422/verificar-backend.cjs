// T-422 — mitad BACKEND ya desplegada (vence-backend:152). ¿El reconciliador publica ya
// `inferredSkips` y dejó de contar como drop lo que fue un salto legítimo?
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  console.log('=== pasadas del cron desde el deploy (23:40 CEST = 21:40 UTC)')
  const runs = await c.query(
    `SELECT ts, severity,
            metadata->>'status'        AS status,
            metadata->>'realDrops'     AS real_drops,
            metadata->>'expectedSkips' AS expected_skips,
            metadata->>'inferredSkips' AS inferred_skips,
            metadata->>'withoutEmail'  AS sin_email
       FROM observable_events
      WHERE event_type = 'cron_run'
        AND endpoint = 'dispute-email-reconciliation'
        AND ts >= now() - interval '3 hours'
      ORDER BY ts DESC LIMIT 6`,
  )
  console.table(runs.rows)

  const conCampo = runs.rows.filter((r) => r.inferred_skips !== null)
  console.log(
    conCampo.length
      ? `✅ ${conCampo.length} pasada(s) YA publican inferredSkips → el código nuevo está vivo`
      : '⏳ ninguna pasada publica inferredSkips todavía (el cron corre en el minuto :15)',
  )

  console.log('\n=== ¿sigue disparando la alerta dispute_email_drop?')
  const al = await c.query(
    `SELECT ts, error_message
       FROM observable_events
      WHERE event_type = 'alert_fired'
        AND metadata->>'rule' = 'dispute_email_drop'
        AND ts >= now() - interval '3 hours'
      ORDER BY ts DESC LIMIT 5`,
  )
  console.table(al.rows)

  console.log('\n=== las 3 de Marta: ¿siguen dentro de la ventana de 24 h del reconciliador?')
  const v = await c.query(
    `SELECT count(*) AS dentro_de_ventana
       FROM question_disputes
      WHERE user_id = '3260627f-2018-4a5e-8234-e6f07015abb9'
        AND status IN ('resolved','rejected')
        AND resolved_at >= now() - interval '24 hours'
        AND resolved_at <= now() - interval '10 minutes'`,
  )
  console.log(v.rows[0])

  await c.end()
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
