#!/usr/bin/env node
// scripts/backfill-loyalty-coupons.cjs
// Aplica cupones de fidelidad a suscripciones activas que deberían tenerlos.
// Uso: node scripts/backfill-loyalty-coupons.cjs          (dry-run por defecto)
//      node scripts/backfill-loyalty-coupons.cjs --apply   (aplicar cambios)

const path = require('path')
require(path.join(__dirname, '..', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '.env.local') })
const Stripe = require(path.join(__dirname, '..', 'node_modules', 'stripe'))

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })

const LOYALTY_10 = 'loyalty_10'
const LOYALTY_20 = 'loyalty_20'
const TIER_1_MAX_RENEWALS = 2

const applyMode = process.argv.includes('--apply')

async function countPaidRenewals(subscriptionId) {
  const invoices = await stripe.invoices.list({
    subscription: subscriptionId,
    status: 'paid',
    limit: 100,
  })
  return invoices.data.filter(inv => inv.billing_reason === 'subscription_cycle').length
}

function determineExpectedCoupon(renewalCount) {
  const upcomingRenewal = renewalCount + 1
  if (upcomingRenewal <= 0) return null
  if (upcomingRenewal <= TIER_1_MAX_RENEWALS) return LOYALTY_10
  return LOYALTY_20
}

async function main() {
  console.log(`\n=== Backfill Loyalty Coupons (${applyMode ? 'APPLY' : 'DRY-RUN'}) ===\n`)

  const subscriptions = await stripe.subscriptions.list({ status: 'active', limit: 100 })
  console.log(`Suscripciones activas: ${subscriptions.data.length}\n`)

  const results = { correct: 0, needsUpdate: 0, applied: 0, errors: 0 }

  for (const sub of subscriptions.data) {
    const renewalCount = await countPaidRenewals(sub.id)
    const currentCoupon = sub.discount?.coupon?.id || null
    const expectedCoupon = renewalCount > 0 ? determineExpectedCoupon(renewalCount) : LOYALTY_10

    if (currentCoupon === expectedCoupon) {
      results.correct++
      continue
    }

    results.needsUpdate++
    const interval = sub.items?.data?.[0]?.price?.recurring?.interval
    const intervalCount = sub.items?.data?.[0]?.price?.recurring?.interval_count || 1

    console.log(`${sub.id} | ${interval}x${intervalCount} | renovaciones: ${renewalCount}`)
    console.log(`  actual: ${currentCoupon || 'NINGUNO'} → esperado: ${expectedCoupon}`)

    if (applyMode) {
      try {
        await stripe.subscriptions.update(sub.id, { coupon: expectedCoupon })
        console.log(`  ✅ Aplicado ${expectedCoupon}`)
        results.applied++
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}`)
        results.errors++
      }
    } else {
      console.log(`  (dry-run, no se aplica)`)
    }
    console.log('')
  }

  console.log('\n=== Resumen ===')
  console.log(`Correctos: ${results.correct}`)
  console.log(`Necesitan actualización: ${results.needsUpdate}`)
  if (applyMode) {
    console.log(`Aplicados: ${results.applied}`)
    console.log(`Errores: ${results.errors}`)
  } else {
    console.log(`\nEjecuta con --apply para aplicar los cambios.`)
  }
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
