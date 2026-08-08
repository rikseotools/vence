// T-422 — ¿qué rastro dejó el cierre de las 6? ¿por qué camino se cerraron?
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const IDS = [
  '0c4740ed-2f98-4279-8ec2-58159288cc62',
  'c9bf1715-460d-4710-99d1-f0d3649ab9fc',
  'd2508ad3-f7cb-4215-9a55-35a67c21d3ae',
  'e2412f9f-9c3b-4072-9df5-5699860f4e15',
  'ce143c99-4970-4a81-9f20-097959a29cd1',
  '4b8eda7c-e21a-48b9-a299-697a7e1bc37f',
]

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  console.log('=== observable_events que mencionan alguna de las 6 (7 días)')
  const ev = await c.query(
    `SELECT created_at, event_type, severity, endpoint, source,
            left(coalesce(error_message,''), 120) AS err,
            metadata->>'disputeId' AS dispute_id
       FROM observable_events
      WHERE created_at >= now() - interval '7 days'
        AND (metadata->>'disputeId' = ANY($1)
             OR error_message LIKE ANY (SELECT '%'||x||'%' FROM unnest($1::text[]) x))
      ORDER BY created_at`,
    [IDS],
  )
  console.table(ev.rows)

  console.log('=== eventos de email/impugnación en la ventana del cierre (30/07 - ahora)')
  const win = await c.query(
    `SELECT date_trunc('minute', created_at) AS minuto, event_type, severity, endpoint, count(*),
            left(min(coalesce(error_message,'')), 100) AS ejemplo
       FROM observable_events
      WHERE created_at >= '2026-07-29 20:00'
        AND (event_type LIKE '%email%' OR event_type LIKE '%dispute%'
             OR endpoint LIKE '%dispute%')
      GROUP BY 1,2,3,4
      ORDER BY 1 DESC
      LIMIT 40`,
  )
  console.table(win.rows)

  console.log('=== ¿la campana sí llegó? notification_events del usuario')
  const notif = await c.query(
    `SELECT created_at, event_type, notification_type,
            left(coalesce(body,title,''),60) AS texto
       FROM notification_events
      WHERE user_id = '3260627f-2018-4a5e-8234-e6f07015abb9'
        AND created_at >= now() - interval '7 days'
      ORDER BY created_at DESC LIMIT 20`,
  ).catch((e) => ({ rows: [{ error: e.message }] }))
  console.table(notif.rows)

  await c.end()
})().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
