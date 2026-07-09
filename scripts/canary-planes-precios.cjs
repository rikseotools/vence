#!/usr/bin/env node
// scripts/canary-planes-precios.cjs
//
// CANARY de los PLANES DE PRECIO (contra Stripe LIVE + la config de env).
// Vigila lo que typecheck y unit tests NO ven: que los price IDs que el
// frontend hornea y el checkout cobra REALMENTE existen en la cuenta de altas
// nuevas (Nila), están activos, y tienen el importe/intervalo esperados.
//
// Puntos ciegos que cubre (cada uno un incidente potencial de ingresos):
//   - Precio archivado/borrado en Stripe → checkout 400 en TODAS las altas.
//   - Env apunta a un ID de la cuenta equivocada (half-flip 07/07 redux).
//   - Importe/intervalo mal (p.ej. anual creado como month) → cobro incorrecto.
//   - Un tier a medio cablear (annual=undefined) → botón que no cobra.
//
// Regla: los 4 tiers (mensual/trimestral/semestral/anual) configurados en env
// para la cuenta de altas nuevas DEBEN existir vivos en Stripe con el importe e
// intervalo canónicos. Cualquier desviación → FALLO (exit 1).
//
// Uso:  node scripts/canary-planes-precios.cjs   (env en .env.local)

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')
const { Client } = require('pg')

// Precios canónicos v2 (2026-07). Fuente de verdad del canary: si Manuel cambia
// los precios, actualizar aquí y en los build-args (Dockerfile/workflow).
const EXPECTED = {
  monthly:   { amount: 2900, interval: 'month', count: 1 },
  quarterly: { amount: 3900, interval: 'month', count: 3 },
  semester:  { amount: 6900, interval: 'month', count: 6 },
  annual:    { amount: 9900, interval: 'year',  count: 1 },
}

// Cuenta de altas nuevas: la que cobra los precios nuevos. Si el flip cambia,
// cambia también qué secret/env verificar.
const SIGNUP_ACCOUNT = (process.env.STRIPE_NEW_SIGNUPS_ACCOUNT || 'manuel').trim()

// Mapa cuenta → sufijo de env + secret key (espejo de lib/stripe.ts ACCOUNT_ENV).
const ACCOUNT = {
  manuel: { suffix: '', secret: 'STRIPE_SECRET_KEY' },
  nila:   { suffix: '_NILA', secret: 'STRIPE_SECRET_KEY_NILA' },
}

async function main() {
  const acct = ACCOUNT[SIGNUP_ACCOUNT]
  if (!acct) throw new Error(`STRIPE_NEW_SIGNUPS_ACCOUNT desconocida: ${SIGNUP_ACCOUNT}`)

  const secret = process.env[acct.secret]
  if (!secret) throw new Error(`Falta ${acct.secret} (secret de la cuenta de altas '${SIGNUP_ACCOUNT}')`)
  const s = new Stripe(secret)

  console.log(`Canary planes-precios · cuenta de altas = '${SIGNUP_ACCOUNT}'`)

  const fails = []
  for (const [tier, exp] of Object.entries(EXPECTED)) {
    const envName = `NEXT_PUBLIC_STRIPE_PRICE_${tier.toUpperCase()}${acct.suffix}`
    const priceId = process.env[envName]

    // Capa 3 (simulación datos reales): el tier debe estar cableado en env.
    if (!priceId) { fails.push(`${tier}: env ${envName} vacío (tier a medio cablear)`); continue }

    // Capa 4 (canary): el precio debe existir vivo en Stripe con el shape correcto.
    let price
    try {
      price = await s.prices.retrieve(priceId)
    } catch (e) {
      fails.push(`${tier}: ${priceId} NO existe en Stripe '${SIGNUP_ACCOUNT}' (${e.message})`)
      continue
    }

    const rec = price.recurring || {}
    const problems = []
    if (!price.active) problems.push('inactivo/archivado')
    if (price.unit_amount !== exp.amount) problems.push(`importe ${price.unit_amount} ≠ ${exp.amount}`)
    if (price.currency !== 'eur') problems.push(`moneda ${price.currency} ≠ eur`)
    if (rec.interval !== exp.interval) problems.push(`interval ${rec.interval} ≠ ${exp.interval}`)
    if ((rec.interval_count || 1) !== exp.count) problems.push(`interval_count ${rec.interval_count} ≠ ${exp.count}`)

    if (problems.length) fails.push(`${tier} (${priceId}): ${problems.join(', ')}`)
    else console.log(`  ✅ ${tier.padEnd(10)} ${priceId}  ${exp.amount / 100}€ ${exp.count}${exp.interval}`)
  }

  // Coherencia: los 4 tiers deben ser price IDs DISTINTOS (evita copy-paste que
  // haría que dos botones cobren lo mismo).
  const ids = Object.keys(EXPECTED).map(t =>
    process.env[`NEXT_PUBLIC_STRIPE_PRICE_${t.toUpperCase()}${acct.suffix}`]).filter(Boolean)
  if (new Set(ids).size !== ids.length) fails.push('hay price IDs duplicados entre tiers')

  // Cierre del bucle en BD: el anual (interval=year) hace que el webhook mapee a
  // plan_type='premium_annual'. Ese INSERT en user_subscriptions se rechazaría
  // si el CHECK constraint no lo acepta → sub premium fantasma, usuario cobrado
  // sin acceso. Verificamos que el constraint VIVO en RDS lo admite.
  if (process.env.DATABASE_URL) {
    const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    try {
      await db.connect()
      const { rows } = await db.query(`
        SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint WHERE conname = 'user_subscriptions_plan_type_check'`)
      const def = rows[0] && rows[0].def
      if (!def) fails.push('constraint user_subscriptions_plan_type_check no encontrado en RDS')
      else if (!def.includes('premium_annual')) fails.push(`el constraint de plan_type NO acepta premium_annual: ${def}`)
      else console.log('  ✅ BD: user_subscriptions acepta plan_type=premium_annual')
    } catch (e) {
      fails.push(`no se pudo verificar el constraint en BD: ${e.message}`)
    } finally {
      await db.end().catch(() => {})
    }
  } else {
    console.log('  ⏭️  DATABASE_URL no configurada — salto verificación de constraint en BD')
  }

  if (fails.length) {
    console.error(`\n❌ CANARY planes-precios FALLA (${fails.length}):`)
    fails.forEach(f => console.error(`   - ${f}`))
    process.exit(1)
  }
  console.log('\n✅ CANARY planes-precios OK (los 4 tiers existen vivos con importe/intervalo correctos)')
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
