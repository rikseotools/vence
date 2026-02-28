// app/api/admin/stripe-fees-summary/route.ts
// API para obtener resumen de fees de Stripe
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDb } from '@/db/client'
import { paymentSettlements } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

export async function GET(request: Request) {
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
    summary.totals.manuelAmount = Math.round(summary.totals.trueNet * 0.9)
    summary.totals.armandoAmount = summary.totals.trueNet - summary.totals.manuelAmount

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
      manuelAmount: Math.round(pendingTrueNet * 0.9),
      armandoAmount: pendingTrueNet - Math.round(pendingTrueNet * 0.9),
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

    return NextResponse.json({
      success: true,
      summary,
      transactions: allTransactions,
      currentBalance,
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
