// T-422 — ¿siguen las 3 impugnaciones sin email? ¿por qué camino se cerraron?
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const IDS = [
  '0c4740ed-2f98-4279-8ec2-58159288cc62',
  'c9bf1715-460d-4710-99d1-f0d3649ab9fc',
  'd2508ad3-f7cb-4215-9a55-35a67c21d3ae',
]
const UID = '3260627f-2018-4a5e-8234-e6f07015abb9'

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  const perfil = await c.query(
    `SELECT up.id, up.email, up.full_name, up.created_at,
            ep.email_soporte_disabled, ep.unsubscribed_all
       FROM user_profiles up
       LEFT JOIN email_preferences ep ON ep.user_id = up.id
      WHERE up.id = $1`,
    [UID],
  )
  console.log('=== usuaria + preferencias de email')
  console.table(perfil.rows)

  const e = await c.query(
    `SELECT event_type, email_type, created_at, subject, error_details
       FROM email_events
      WHERE email_address = $1
        AND created_at >= now() - interval '5 days'
      ORDER BY created_at DESC
      LIMIT 25`,
    [perfil.rows[0]?.email],
  )
  console.log(`=== email_events de esa dirección (5 días): ${e.rowCount}`)
  console.table(e.rows)

  // Réplica EXACTA del veredicto del reconciliador, pero sin ventana de 24h
  const rec = await c.query(
    `SELECT qd.id AS dispute_id, qd.status, qd.resolved_at, up.email,
            COALESCE(ep.email_soporte_disabled, false) AS soporte_disabled,
            EXISTS (SELECT 1 FROM email_events ee
                     WHERE ee.email_address = up.email
                       AND ee.email_type = 'impugnacion_respuesta'
                       AND ee.created_at >= qd.resolved_at - interval '2 minutes') AS has_email_event
       FROM question_disputes qd
       JOIN user_profiles up ON up.id = qd.user_id
       LEFT JOIN email_preferences ep ON ep.user_id = qd.user_id
      WHERE qd.id = ANY($1::uuid[])`,
    [IDS],
  )
  console.log('=== veredicto del reconciliador para las 3')
  console.table(rec.rows)

  // ¿Cuántas resueltas SIN email en total (no solo 24h)?
  const amplio = await c.query(
    `SELECT qd.id, up.email, qd.status, qd.resolved_at,
            COALESCE(ep.email_soporte_disabled,false) AS soporte_off
       FROM question_disputes qd
       JOIN user_profiles up ON up.id = qd.user_id
       LEFT JOIN email_preferences ep ON ep.user_id = qd.user_id
      WHERE qd.status IN ('resolved','rejected')
        AND qd.admin_response IS NOT NULL AND length(btrim(qd.admin_response)) > 0
        AND qd.resolved_at >= now() - interval '7 days'
        AND NOT EXISTS (SELECT 1 FROM email_events ee
                         WHERE ee.email_address = up.email
                           AND ee.email_type = 'impugnacion_respuesta'
                           AND ee.created_at >= qd.resolved_at - interval '2 minutes')
      ORDER BY qd.resolved_at DESC`,
  )
  console.log(`=== TODAS las cerradas sin email en 7 días: ${amplio.rowCount}`)
  console.table(amplio.rows)

  await c.end()
})().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
