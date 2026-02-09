import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Descripciones en español para tipos de transacción
function getTypeDescription(type) {
  const descriptions = {
    charge: 'Pago recibido',
    payout: 'Transferencia a banco',
    stripe_fee: 'Comisión Stripe Billing',
    refund: 'Reembolso',
    advance: 'Anticipo de fondos',
    advance_funding: 'Movimiento de anticipo',
    payout_failure: 'Transferencia fallida (revertida)',
    adjustment: 'Ajuste',
  };
  return descriptions[type] || type;
}

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/admin/stripe-fees-summary
 *
 * Obtiene un resumen REAL de todos los fees de Stripe:
 * - Fees de procesamiento de pagos (charge fees)
 * - Fees de transferencias a banco (payout fees)
 * - Fees de facturación (billing usage fees)
 *
 * Calcula el neto REAL después de TODOS los fees
 */
export async function GET(request) {
  try {
    // Obtener todas las transacciones de balance (últimos 100 o desde una fecha)
    const url = new URL(request.url);
    const sinceDate = url.searchParams.get('since');

    const params = {
      limit: 100,
    };

    if (sinceDate) {
      params.created = {
        gte: Math.floor(new Date(sinceDate).getTime() / 1000),
      };
    }

    const transactions = await stripe.balanceTransactions.list(params);

    // Clasificar transacciones
    const summary = {
      // Pagos (cargos a clientes)
      charges: {
        count: 0,
        totalGross: 0,      // Bruto total de pagos
        totalFees: 0,       // Fees de procesamiento
        totalNet: 0,        // Neto después de fees de procesamiento
        items: [],
      },

      // Transferencias a banco (payouts)
      payouts: {
        count: 0,
        totalAmount: 0,     // Total transferido
        totalFees: 0,       // Fees de transferencia
        items: [],
      },

      // Fees de plataforma (billing, etc.)
      platformFees: {
        count: 0,
        totalFees: 0,
        items: [],
      },

      // Otros (reembolsos, disputas, etc.)
      other: {
        count: 0,
        totalAmount: 0,
        items: [],
      },

      // TOTALES FINALES
      totals: {
        grossRevenue: 0,          // Ingresos brutos (pagos de clientes)
        chargeFees: 0,            // Fees por procesar pagos
        payoutFees: 0,            // Fees por transferir a banco
        billingFees: 0,           // Fees de Stripe Billing
        totalAllFees: 0,          // TODOS los fees sumados
        trueNet: 0,               // Neto REAL después de todos los fees

        // Reparto (sobre el neto real)
        manuelAmount: 0,          // 90% del neto real
        armandoAmount: 0,         // 10% del neto real
      },
    };

    // Procesar cada transacción
    for (const t of transactions.data) {
      const item = {
        id: t.id,
        date: new Date(t.created * 1000).toISOString(),
        type: t.type,
        description: t.description,
        amount: t.amount,       // En céntimos
        fee: t.fee,             // En céntimos
        net: t.net,             // En céntimos
        source: t.source,
      };

      switch (t.type) {
        case 'charge':
          summary.charges.count++;
          summary.charges.totalGross += t.amount;
          summary.charges.totalFees += t.fee;
          summary.charges.totalNet += t.net;
          summary.charges.items.push(item);
          break;

        case 'payout':
          summary.payouts.count++;
          summary.payouts.totalAmount += Math.abs(t.amount);
          summary.payouts.totalFees += t.fee;
          summary.payouts.items.push(item);
          break;

        case 'stripe_fee':
          summary.platformFees.count++;
          summary.platformFees.totalFees += Math.abs(t.amount);
          summary.platformFees.items.push(item);
          break;

        // Ignorar movimientos internos de anticipos
        case 'advance':
        case 'advance_funding':
        case 'payout_failure':
          break;

        default:
          summary.other.count++;
          summary.other.totalAmount += t.amount;
          summary.other.items.push(item);
          break;
      }
    }

    // Calcular totales finales
    summary.totals.grossRevenue = summary.charges.totalGross;
    summary.totals.chargeFees = summary.charges.totalFees;
    summary.totals.payoutFees = summary.payouts.totalFees;
    summary.totals.billingFees = summary.platformFees.totalFees;
    summary.totals.totalAllFees =
      summary.totals.chargeFees +
      summary.totals.payoutFees +
      summary.totals.billingFees;
    summary.totals.trueNet =
      summary.totals.grossRevenue - summary.totals.totalAllFees;

    // Reparto 90/10 sobre el neto REAL
    summary.totals.manuelAmount = Math.round(summary.totals.trueNet * 0.9);
    summary.totals.armandoAmount =
      summary.totals.trueNet - summary.totals.manuelAmount;

    // Obtener pagos pendientes de confirmar desde BD
    const { data: pendingSettlements } = await getSupabase()
      .from('payment_settlements')
      .select('*')
      .eq('manuel_confirmed_received', false);

    // Calcular pendientes (basado en pagos no confirmados)
    let pendingGross = 0;
    let pendingChargeFees = 0;

    if (pendingSettlements) {
      pendingSettlements.forEach((s) => {
        pendingGross += s.amount_gross;
        pendingChargeFees += s.stripe_fee;
      });
    }

    // Estimar fees de payout para pendientes (~1% del neto)
    const pendingNetAfterCharge = pendingGross - pendingChargeFees;
    const estimatedPendingPayoutFee = Math.round(pendingNetAfterCharge * 0.01);
    const pendingTrueNet = pendingNetAfterCharge - estimatedPendingPayoutFee;

    summary.pending = {
      payments: pendingSettlements?.length || 0,
      gross: pendingGross,
      chargeFees: pendingChargeFees,
      estimatedPayoutFees: estimatedPendingPayoutFee,
      trueNet: pendingTrueNet,
      manuelAmount: Math.round(pendingTrueNet * 0.9),
      armandoAmount: pendingTrueNet - Math.round(pendingTrueNet * 0.9),
    };

    // Crear lista de transacciones para mostrar en UI
    const allTransactions = transactions.data.map(t => ({
      id: t.id,
      date: new Date(t.created * 1000).toISOString(),
      type: t.type,
      description: t.description || getTypeDescription(t.type),
      amount: t.amount,
      fee: t.fee,
      net: t.net,
      source: t.source,
    }));

    // Obtener balance actual de Stripe
    const balance = await stripe.balance.retrieve();
    const currentBalance = {
      available: balance.available.reduce((sum, b) => sum + b.amount, 0),
      pending: balance.pending.reduce((sum, b) => sum + b.amount, 0),
    };

    return NextResponse.json({
      success: true,
      summary,
      transactions: allTransactions,
      currentBalance,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Stripe fees:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
