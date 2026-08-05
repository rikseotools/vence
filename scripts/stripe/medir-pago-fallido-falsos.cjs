#!/usr/bin/env node
/**
 * T-594 — ¿A cuánta gente que PAGA BIEN le estamos mandando «Problema con el pago»?
 *
 * Cuenta los correos `pago_fallido` y, de ésos, los que salieron a alguien cuya suscripción se
 * activó en los minutos siguientes: la firma de la autenticación del banco (3DS/SCA), que Stripe
 * anuncia con un `invoice.payment_failed` que NO es un rechazo.
 *
 * Es la MEDIDA, no el arreglo: sirve para dimensionarlo antes y para comprobar que después del
 * despliegue baja a cero. No escribe nada.
 *
 *   node scripts/stripe/medir-pago-fallido-falsos.cjs [--dias 30]
 */
require('dotenv').config({ path: '.env.local' })
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')

const arg = (n, def) => {
  const i = process.argv.indexOf(n)
  return i > -1 ? process.argv[i + 1] : def
}
const DIAS = Number(arg('--dias', 30))
// Ventana generosa: el 3DS lo resuelve la gente en segundos, pero a veces busca el móvil.
const VENTANA_S = 600

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  const { rows: [tot] } = await c.query(
    `SELECT count(*)::int n FROM email_events
     WHERE email_type='pago_fallido' AND event_type='sent'
       AND created_at > now() - ($1 || ' days')::interval`, [DIAS])

  const { rows: falsos } = await c.query(
    `SELECT e.created_at AS email_at, u.email,
            extract(epoch FROM (s.current_period_start - e.created_at)) AS delta_s
     FROM email_events e
     JOIN user_profiles u ON u.id = e.user_id
     JOIN user_subscriptions s ON s.user_id = e.user_id
     WHERE e.email_type='pago_fallido' AND e.event_type='sent'
       AND e.created_at > now() - ($1 || ' days')::interval
       AND s.status='active'
       AND abs(extract(epoch FROM (s.current_period_start - e.created_at))) < $2
     ORDER BY e.created_at DESC`, [DIAS, VENTANA_S])

  const pct = tot.n ? Math.round((falsos.length / tot.n) * 100) : 0
  console.log(`\n📧 pago_fallido — últimos ${DIAS} días`)
  console.log(`   enviados:              ${tot.n}`)
  console.log(`   a quien pagó bien:     ${falsos.length}  (${pct}%)`)
  console.log(`   ventana considerada:   ±${VENTANA_S}s entre el correo y el alta del periodo\n`)

  for (const r of falsos.slice(0, 20)) {
    console.log(`   ${r.email_at.toISOString()}  ${r.email}  (${Math.round(r.delta_s)}s)`)
  }
  if (falsos.length > 20) console.log(`   … y ${falsos.length - 20} más`)

  console.log(
    falsos.length === 0
      ? '\n✅ Ninguno. El aviso solo sale cuando el pago falla de verdad.'
      : '\n⚠️  Cada uno de esos es alguien a quien asustamos en mitad de su compra.',
  )
  await c.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
