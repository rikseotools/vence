// T-363 — ¿hay ya evidencia REAL del aplazamiento, sin escribir nada?
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  console.log('=== población: ofertas de precio heredado VIVAS y con cobertura por delante')
  const pob = await c.query(
    `SELECT count(*) AS ofertas_vivas,
            count(*) FILTER (WHERE cob.hasta IS NOT NULL) AS con_cobertura,
            count(*) FILTER (WHERE cob.hasta > now() + interval '48 hours') AS aplazarian
       FROM user_price_offers o
       LEFT JOIN LATERAL (
         SELECT max(current_period_end) AS hasta FROM user_subscriptions s
          WHERE s.user_id = o.user_id AND s.status = 'active' AND s.current_period_end > now()
       ) cob ON true
      WHERE o.revoked_at IS NULL`,
  )
  console.table(pob.rows)

  console.log('\n=== ¿alguien ha CANJEADO desde que se desplegó (ed51de37, 01/08 ~00:30 UTC)?')
  const canjes = await c.query(
    `SELECT s.user_id, s.status, s.created_at, s.current_period_end, s.stripe_subscription_id
       FROM user_subscriptions s
      WHERE s.created_at >= now() - interval '12 hours'
      ORDER BY s.created_at DESC LIMIT 10`,
  )
  console.table(canjes.rows)

  console.log('\n=== ¿hay alguna suscripción en `trialing` (la huella que dejaría el arreglo)?')
  const tr = await c.query(
    `SELECT count(*) AS trialing_total,
            count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS trialing_7d
       FROM user_subscriptions WHERE status = 'trialing'`,
  )
  console.table(tr.rows)

  await c.end()
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
