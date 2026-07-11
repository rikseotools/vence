/**
 * Script para importar pagos existentes de Stripe a payment_settlements
 * Ejecutar: node scripts/import-stripe-payments.cjs
 */

require('dotenv').config({ path: '.env.local' })

const Stripe = require('stripe')
const { createClient } = require('./lib/pg-agnostic-client.cjs')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function importPayments() {
  console.log('🚀 Importando pagos de Stripe...\n')

  try {
    // Obtener todos los pagos exitosos (charges)
    const charges = await stripe.charges.list({
      limit: 100,
      status: 'succeeded'
    })

    console.log(`📊 Encontrados ${charges.data.length} pagos exitosos\n`)

    let imported = 0
    let skipped = 0
    let errors = 0

    for (const charge of charges.data) {
      try {
        // Saltar si no tiene balance_transaction (reembolsos, etc)
        if (!charge.balance_transaction) {
          console.log(`⏭️  Saltando ${charge.id} - sin balance_transaction`)
          skipped++
          continue
        }

        // Obtener el balance_transaction para conocer el fee
        const balanceTransaction = await stripe.balanceTransactions.retrieve(
          charge.balance_transaction
        )

        const amountGross = charge.amount
        const stripeFee = balanceTransaction.fee
        const amountNet = amountGross - stripeFee
        const manuelAmount = Math.round(amountNet * 0.9)
        const armandoAmount = amountNet - manuelAmount

        // Buscar usuario por stripe_customer_id
        let userId = null
        let userEmail = charge.billing_details?.email || charge.receipt_email

        if (charge.customer) {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('id, email')
            .eq('stripe_customer_id', charge.customer)
            .single()

          if (userProfile) {
            userId = userProfile.id
            userEmail = userProfile.email || userEmail
          }
        }

        // Insertar en payment_settlements
        const { error } = await supabase
          .from('payment_settlements')
          .insert({
            stripe_payment_intent_id: charge.payment_intent,
            stripe_charge_id: charge.id,
            stripe_invoice_id: charge.invoice,
            stripe_customer_id: charge.customer,
            user_id: userId,
            user_email: userEmail,
            amount_gross: amountGross,
            stripe_fee: stripeFee,
            amount_net: amountNet,
            currency: charge.currency,
            manuel_amount: manuelAmount,
            armando_amount: armandoAmount,
            payment_date: new Date(charge.created * 1000).toISOString()
          })

        if (error) {
          if (error.code === '23505') {
            console.log(`⏭️  ${charge.id} ya existe (duplicado)`)
            skipped++
          } else {
            console.error(`❌ Error insertando ${charge.id}:`, error.message)
            errors++
          }
        } else {
          const fecha = new Date(charge.created * 1000).toLocaleDateString('es-ES')
          console.log(`✅ ${fecha} | ${userEmail || 'Sin email'} | ${(amountGross/100).toFixed(2)}€ bruto | ${(stripeFee/100).toFixed(2)}€ fee | Manuel: ${(manuelAmount/100).toFixed(2)}€ | Armando: ${(armandoAmount/100).toFixed(2)}€`)
          imported++
        }

      } catch (err) {
        console.error(`❌ Error procesando ${charge.id}:`, err.message)
        errors++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log(`✅ Importados: ${imported}`)
    console.log(`⏭️  Saltados/Duplicados: ${skipped}`)
    console.log(`❌ Errores: ${errors}`)
    console.log('='.repeat(60))

    // Mostrar resumen
    const { data: summary } = await supabase
      .from('settlement_summary')
      .select('*')
      .single()

    if (summary) {
      console.log('\n📊 RESUMEN TOTAL:')
      console.log(`   Total pagos: ${summary.total_payments}`)
      console.log(`   Total neto: ${(summary.total_net/100).toFixed(2)}€`)
      console.log(`   Manuel (90%): ${(summary.total_manuel/100).toFixed(2)}€`)
      console.log(`   Armando (10%): ${(summary.total_armando/100).toFixed(2)}€`)
      console.log(`   Pendiente Manuel: ${(summary.pending_manuel/100).toFixed(2)}€`)
    }

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

importPayments()
