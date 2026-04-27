// app/api/admin/stripe-fees-summary/route.ts
// API para obtener resumen de fees de Stripe
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminDb as getDb } from '@/db/client'
import { paymentSettlements } from '@/db/schema'
import { eq } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!)

// Descripciones en español para tipos de transacción
function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    charge: 'Pago recibido',
    payout: 'Transferencia a banco',
    stripe_fee: 'Comisión Stripe Billing',
    refund: 'Reembolso',
    advance: 'Anticipo de fondos',
    advance_funding: 'Movimiento de anticipo',
    payout_failure: 'Transferencia fallida (revertida)',
    adjustment: 'Ajuste',
  }
  return descriptions[type] || type
}

async function _GET(request: Request) {
  try {
    const url = new URL(request.url)
    const sinceDate = url.searchParams.get('since')

    const params: Stripe.BalanceTransactionListParams = { limit: 100 }

    if (sinceDate) {
      params.created = {
        gte: Math.floor(new Date(sinceDate).getTime() / 1000),
      }
    }

    const transactions = await getStripe().balanceTransactions.list(params)

    // Clasificar transacciones
    const summary = {
      charges: { count: 0, totalGross: 0, totalFees: 0, totalNet: 0, items: [] as unknown[] },
      payouts: { count: 0, totalAmount: 0, totalFees: 0, items: [] as unknown[] },
      platformFees: { count: 0, totalFees: 0, items: [] as unknown[] },
      other: { count: 0, totalAmount: 0, items: [] as unknown[] },
      totals: {
        grossRevenue: 0, chargeFees: 0, payoutFees: 0, billingFees: 0,
        totalAllFees: 0, trueNet: 0, manuelAmount: 0, armandoAmount: 0,
      },
      pending: {
        payments: 0, gross: 0, chargeFees: 0, estimatedPayoutFees: 0,
        trueNet: 0, manuelAmount: 0, armandoAmount: 0,
      },
    }

    for (const t of transactions.data) {
      const item = {
        id: t.id,
        date: new Date(t.created * 1000).toISOString(),
        type: t.type,
        description: t.description,
        amount: t.amount,
        fee: t.fee,
        net: t.net,
        source: t.source,
      }

      switch (t.type) {
        case 'charge':
          summary.charges.count++
          summary.charges.totalGross += t.amount
          summary.charges.totalFees += t.fee
          summary.charges.totalNet += t.net
          summary.charges.items.push(item)
          break
        case 'payout':
          summary.payouts.count++
          summary.payouts.totalAmount += Math.abs(t.amount)
          summary.payouts.totalFees += t.fee
          summary.payouts.items.push(item)
          break
        case 'stripe_fee':
          summary.platformFees.count++
          summary.platformFees.totalFees += Math.abs(t.amount)
          summary.platformFees.items.push(item)
          break
        case 'advance':
        case 'advance_funding':
        case 'payout_failure':
          break
        default:
          summary.other.count++
          summary.other.totalAmount += t.amount
          summary.other.items.push(item)
          break
      }
    }

    // Calcular totales finales
    summary.totals.grossRevenue = summary.charges.totalGross
    summary.totals.chargeFees = summary.charges.totalFees
    summary.totals.payoutFees = summary.payouts.totalFees
    summary.totals.billingFees = summary.platformFees.totalFees
    summary.totals.totalAllFees = summary.totals.chargeFees + summary.totals.payoutFees + summary.totals.billingFees
    summary.totals.trueNet = summary.totals.grossRevenue - summary.totals.totalAllFees
    // Nota: los porcentajes reales se calculan al final con stripeCommissionPct
    // Estos valores son placeholder que se recalculan abajo
    summary.totals.manuelAmount = 0
    summary.totals.armandoAmount = 0

    // Obtener pagos pendientes de confirmar desde BD (Drizzle inline)
    const db = getDb()
    const pendingSettlementsData = await db
      .select()
      .from(paymentSettlements)
      .where(eq(paymentSettlements.manuelConfirmedReceived, false))

    let pendingGross = 0
    let pendingChargeFees = 0

    if (pendingSettlementsData) {
      pendingSettlementsData.forEach(s => {
        pendingGross += s.amountGross
        pendingChargeFees += s.stripeFee
      })
    }

    const pendingNetAfterCharge = pendingGross - pendingChargeFees
    const estimatedPendingPayoutFee = Math.round(pendingNetAfterCharge * 0.01)
    const pendingTrueNet = pendingNetAfterCharge - estimatedPendingPayoutFee

    summary.pending = {
      payments: pendingSettlementsData?.length || 0,
      gross: pendingGross,
      chargeFees: pendingChargeFees,
      estimatedPayoutFees: estimatedPendingPayoutFee,
      trueNet: pendingTrueNet,
      manuelAmount: 0, // recalculado abajo con comisión dinámica
      armandoAmount: 0,
    }

    const allTransactions = transactions.data.map(t => ({
      id: t.id,
      date: new Date(t.created * 1000).toISOString(),
      type: t.type,
      description: t.description || getTypeDescription(t.type),
      amount: t.amount,
      fee: t.fee,
      net: t.net,
      source: t.source,
    }))

    // Obtener balance actual de Stripe
    const balance = await getStripe().balance.retrieve()
    const currentBalance = {
      available: balance.available.reduce((sum, b) => sum + b.amount, 0),
      pending: balance.pending.reduce((sum, b) => sum + b.amount, 0),
    }

    // Calcular facturado últimas 4 semanas (pagos recibidos - reembolsos)
    // Nota: no coincide exactamente con el "Volumen neto" de Stripe Billing
    // porque Stripe aplica ajustes internos que no expone via API
    const fourWeeksAgo = Math.floor(Date.now() / 1000) - (28 * 24 * 60 * 60)
    let grossCharges = 0
    let totalRefunds = 0
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const params: Record<string, unknown> = { type: 'charge', created: { gte: fourWeeksAgo }, limit: 100 }
      if (startingAfter) params.starting_after = startingAfter
      const batch = await getStripe().balanceTransactions.list(params as any)
      for (const t of batch.data) grossCharges += t.amount
      hasMore = batch.has_more
      if (batch.data.length) startingAfter = batch.data[batch.data.length - 1].id
    }

    hasMore = true
    startingAfter = undefined
    while (hasMore) {
      const params: Record<string, unknown> = { type: 'refund', created: { gte: fourWeeksAgo }, limit: 100 }
      if (startingAfter) params.starting_after = startingAfter
      const batch = await getStripe().balanceTransactions.list(params as any)
      for (const t of batch.data) totalRefunds += Math.abs(t.amount)
      hasMore = batch.has_more
      if (batch.data.length) startingAfter = batch.data[batch.data.length - 1].id
    }

    const netVolume4w = grossCharges - totalRefunds

    // Comisión Stripe escalonada según volumen neto (en céntimos)
    // >= 6000€ → 5%, >= 5000€ → 6%, >= 4000€ → 7%, >= 3000€ → 8%, >= 2000€ → 9%, < 2000€ → 10%
    const netEuros = netVolume4w / 100
    let stripeCommissionPct = 10
    if (netEuros >= 6000) stripeCommissionPct = 5
    else if (netEuros >= 5000) stripeCommissionPct = 6
    else if (netEuros >= 4000) stripeCommissionPct = 7
    else if (netEuros >= 3000) stripeCommissionPct = 8
    else if (netEuros >= 2000) stripeCommissionPct = 9

    // Recalcular montos con comisión dinámica
    const manuelPct = (100 - stripeCommissionPct) / 100
    summary.totals.manuelAmount = Math.round(summary.totals.trueNet * manuelPct)
    summary.totals.armandoAmount = summary.totals.trueNet - summary.totals.manuelAmount
    summary.pending.manuelAmount = Math.round(pendingTrueNet * manuelPct)
    summary.pending.armandoAmount = pendingTrueNet - summary.pending.manuelAmount

    return NextResponse.json({
      success: true,
      summary,
      transactions: allTransactions,
      currentBalance,
      netVolume4w,
      stripeCommissionPct,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ [API/admin/stripe-fees-summary] Error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/stripe-fees-summary', _GET)
