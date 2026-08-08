// T-422 — ¿se llegó a ENTRAR en sendEmailV2? El token de baja se inserta antes de enviar.
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const UID = '3260627f-2018-4a5e-8234-e6f07015abb9'

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  console.log('=== email_unsubscribe_tokens de la usuaria (7 días)')
  const t = await c.query(
    `SELECT created_at, email_type, email
       FROM email_unsubscribe_tokens
      WHERE user_id = $1 AND created_at >= now() - interval '7 days'
      ORDER BY created_at DESC LIMIT 20`,
    [UID],
  )
  console.table(t.rows)

  console.log('=== CONTRASTE: impugnaciones de OTROS usuarios cerradas en 7 días CON email')
  const ok = await c.query(
    `SELECT qd.id, up.email, qd.resolved_at,
            (SELECT count(*) FROM email_events ee
              WHERE ee.email_address = up.email
                AND ee.email_type = 'impugnacion_respuesta'
                AND ee.created_at >= qd.resolved_at - interval '2 minutes') AS emails,
            (SELECT count(*) FROM email_unsubscribe_tokens t
              WHERE t.user_id = qd.user_id AND t.email_type = 'impugnacion_respuesta'
                AND t.created_at >= qd.resolved_at - interval '2 minutes') AS tokens
       FROM question_disputes qd
       JOIN user_profiles up ON up.id = qd.user_id
      WHERE qd.status IN ('resolved','rejected')
        AND qd.admin_response IS NOT NULL AND length(btrim(qd.admin_response)) > 0
        AND qd.resolved_at >= now() - interval '7 days'
      ORDER BY qd.resolved_at DESC`,
  )
  console.table(ok.rows)

  console.log('=== ¿tiene la usuaria fila en email_preferences? (el gate lee de ahí)')
  const p = await c.query(
    `SELECT * FROM email_preferences WHERE user_id = $1`,
    [UID],
  )
  console.log(p.rows)

  await c.end()
})().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
