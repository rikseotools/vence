// T-448 — ¿a cuántos de los que se apagan les saldría oferta, y por cuánto? SOLO LEE.
// Reproduce lo que haría `asegurarOfertaHeredada` sin escribir ni en Stripe ni en la BD.
import 'dotenv/config'
import { Client } from 'pg'
import Stripe from 'stripe'
import { derivarPrecioHeredado } from '../../lib/stripe/precioHeredado'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  const { rows } = await c.query(`
    SELECT p.id, p.email, p.stripe_customer_id, s.current_period_end
      FROM user_subscriptions s JOIN user_profiles p ON p.id = s.user_id
     WHERE p.payment_account = 'manuel' AND s.cancel_at_period_end = true
       AND s.current_period_end > now()
     ORDER BY s.current_period_end`)
  await c.end()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const conteo: Record<string, number> = {}
  const precios: Record<string, number> = {}
  let sinCliente = 0

  for (const u of rows) {
    if (!u.stripe_customer_id) { sinCliente++; conteo.sin_customer = (conteo.sin_customer ?? 0) + 1; continue }
    try {
      const lista = await stripe.subscriptions.list({ customer: u.stripe_customer_id, status: 'all', limit: 20 })
      if (!lista.data.length) { conteo.sin_historico = (conteo.sin_historico ?? 0) + 1; continue }
      const derivado = derivarPrecioHeredado(lista.data.map((s) => {
        const price = s.items.data[0]?.price
        return {
          estado: s.status,
          centimos: price?.unit_amount ?? null,
          intervalo: (price?.recurring?.interval as 'month' | 'year' | undefined) ?? null,
          intervalCount: price?.recurring?.interval_count ?? null,
          creadaEn: s.created,
        }
      }))
      if (!derivado) { conteo.sin_precio_derivable = (conteo.sin_precio_derivable ?? 0) + 1; continue }
      conteo.tendria_oferta = (conteo.tendria_oferta ?? 0) + 1
      const k = `${(derivado.centimos / 100).toFixed(2)} € ${derivado.intervalo}`
      precios[k] = (precios[k] ?? 0) + 1
    } catch (e) {
      conteo.error_stripe = (conteo.error_stripe ?? 0) + 1
    }
  }

  console.log(`analizadas ${rows.length} personas que se apagan (sin escribir nada)\n`)
  console.log('=== resultado si se les creara la oferta AHORA:')
  console.table(Object.entries(conteo).map(([estado, n]) => ({ estado, personas: n })))
  console.log('\n=== qué precio recuperaría cada una:')
  console.table(Object.entries(precios).sort((a, b) => b[1] - a[1]).map(([precio, n]) => ({ precio, personas: n })))
  if (sinCliente) console.log(`\n⚠️ ${sinCliente} sin stripe_customer_id: a esas el botón las manda hoy a /premium (tarifa nueva)`)
})()
