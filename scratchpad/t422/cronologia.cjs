// T-422 — el corte de mayo: ¿recibía emails ANTES del botón rojo (01/05) y dejó de recibirlos DESPUÉS?
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  const r = await c.query(
    `SELECT date_trunc('month', qd.resolved_at) AS mes,
            count(*) AS cerradas,
            count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM email_events ee
               WHERE ee.email_address = 'marta_benitopadilla@hotmail.com'
                 AND ee.email_type = 'impugnacion_respuesta'
                 AND ee.created_at BETWEEN qd.resolved_at - interval '2 minutes'
                                       AND qd.resolved_at + interval '10 minutes')) AS con_email
       FROM question_disputes qd
      WHERE qd.user_id = '3260627f-2018-4a5e-8234-e6f07015abb9'
        AND qd.status IN ('resolved','rejected')
        AND qd.admin_response IS NOT NULL AND length(btrim(qd.admin_response)) > 0
      GROUP BY 1 ORDER BY 1`,
  )
  console.log('=== Marta: cerradas vs con email, por mes (botón rojo el 01/05/2026)')
  console.table(r.rows)

  const tot = await c.query(
    `SELECT count(*) AS total_sin_email
       FROM question_disputes qd
      WHERE qd.user_id = '3260627f-2018-4a5e-8234-e6f07015abb9'
        AND qd.status IN ('resolved','rejected')
        AND qd.admin_response IS NOT NULL AND length(btrim(qd.admin_response)) > 0
        AND qd.resolved_at >= '2026-05-01'
        AND NOT EXISTS (SELECT 1 FROM email_events ee
                         WHERE ee.email_address = 'marta_benitopadilla@hotmail.com'
                           AND ee.email_type = 'impugnacion_respuesta'
                           AND ee.created_at >= qd.resolved_at - interval '2 minutes')`,
  )
  console.log('=== respuestas suyas sin entregar desde el botón rojo:', tot.rows[0].total_sin_email)

  // Los 2 que siguen con el soporte apagado
  const off = await c.query(
    `SELECT ep.user_id, up.email, ep.unsubscribed_all, ep.updated_at
       FROM email_preferences ep JOIN user_profiles up ON up.id = ep.user_id
      WHERE ep.email_soporte_disabled`,
  )
  console.log('=== los que AÚN tienen el soporte apagado')
  console.table(off.rows)

  await c.end()
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
