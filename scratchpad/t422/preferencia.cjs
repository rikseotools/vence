// T-422 — ¿cuándo y a quién se le cambió email_soporte_disabled? La alerta lo lee HOY,
// pero el envío se decidió con el valor que había ENTONCES.
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  console.log('=== estado actual del universo del botón rojo')
  const tot = await c.query(
    `SELECT count(*) FILTER (WHERE email_soporte_disabled) AS soporte_off,
            count(*) FILTER (WHERE unsubscribed_all) AS baja_total,
            count(*) FILTER (WHERE email_soporte_disabled AND updated_at >= now() - interval '2 days') AS off_tocados_2d,
            count(*) FILTER (WHERE NOT email_soporte_disabled AND unsubscribed_all
                             AND updated_at >= now() - interval '2 days') AS reactivados_2d
       FROM email_preferences`,
  )
  console.table(tot.rows)

  console.log('=== filas de email_preferences tocadas en 2 días (quién se movió)')
  const mov = await c.query(
    `SELECT ep.user_id, up.email, ep.email_soporte_disabled, ep.unsubscribed_all,
            ep.unsubscribed_at, ep.updated_at
       FROM email_preferences ep
       JOIN user_profiles up ON up.id = ep.user_id
      WHERE ep.updated_at >= now() - interval '2 days'
      ORDER BY ep.updated_at DESC LIMIT 25`,
  )
  console.table(mov.rows)

  console.log('=== eventos de preferencias/unsubscribe hoy')
  const ev = await c.query(
    `SELECT created_at, event_type, severity, endpoint, source,
            left(coalesce(error_message,''),80) AS err
       FROM observable_events
      WHERE created_at >= now() - interval '2 days'
        AND (endpoint ILIKE '%unsubscribe%' OR endpoint ILIKE '%email-preferences%'
             OR event_type ILIKE '%unsubscribe%' OR event_type ILIKE '%preferen%')
      ORDER BY created_at DESC LIMIT 30`,
  )
  console.table(ev.rows)

  console.log('=== las 22 respuestas sin entregar de Marta: ¿cuántas y de cuándo?')
  const marta = await c.query(
    `SELECT date_trunc('day', resolved_at) AS dia, count(*)
       FROM question_disputes
      WHERE user_id = '3260627f-2018-4a5e-8234-e6f07015abb9'
        AND status IN ('resolved','rejected')
        AND admin_response IS NOT NULL AND length(btrim(admin_response)) > 0
      GROUP BY 1 ORDER BY 1 DESC LIMIT 20`,
  )
  console.table(marta.rows)

  await c.end()
})().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
