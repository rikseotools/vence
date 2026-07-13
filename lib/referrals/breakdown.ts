// lib/referrals/breakdown.ts
//
// Desglose ADMIN de un embajador: fusiona sus 3 fuentes de recompensa
// (bugs/opiniones, referidos, pagos) en UNA línea de tiempo ordenada, cada
// fila con su ASUNTO, para que el admin lo controle. PURO → testeable.
//
// POR QUÉ (feedback Manuel 13/07): el panel de embajadores mostraba saldos
// pero no dejaba ver, al pinchar, QUÉ compone ese saldo ni el asunto de cada
// recompensa (qué bug, a quién refirió, qué vale). Esta función arma esa vista.

export type BreakdownKind = 'bug' | 'ugc' | 'referral' | 'payout'

export interface BreakdownRow {
  kind: BreakdownKind
  /** € de la recompensa/pago. */
  amount: number
  /** approved | pending | paid | rejected | qualified … (según la fuente). */
  status: string
  /** ISO date. */
  date: string
  /** El "asunto" para tenerlo controlado: extracto del feedback (bug), URL
   *  (opinión), email del referido (referido) o método+ref (pago). */
  asunto: string
}

/** Fusiona las 3 fuentes en una sola lista ordenada por fecha DESC (lo más
 *  reciente arriba). No inventa importes: usa los que llegan. */
export function mergeBreakdown(
  submissions: readonly BreakdownRow[],
  referrals: readonly BreakdownRow[],
  payouts: readonly BreakdownRow[],
): BreakdownRow[] {
  return [...submissions, ...referrals, ...payouts].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  )
}

export interface BreakdownTotals {
  /** Ganado por recompensas (bug+ugc+referral), sin contar pagos. */
  earned: number
  /** Pagado (payouts status='paid'). */
  paid: number
  /** Solicitado y aún no pagado (payouts status='pending') = pidió el vale. */
  requested: number
  byKind: Record<BreakdownKind, { count: number; amount: number }>
}

/** Totales para la cabecera del desglose. Separa recompensas (earned) de
 *  pagos, y marca lo SOLICITADO (pendiente de pago) — la señal de "pidió vale". */
export function summarizeBreakdown(rows: readonly BreakdownRow[]): BreakdownTotals {
  const byKind: BreakdownTotals['byKind'] = {
    bug: { count: 0, amount: 0 },
    ugc: { count: 0, amount: 0 },
    referral: { count: 0, amount: 0 },
    payout: { count: 0, amount: 0 },
  }
  let earned = 0, paid = 0, requested = 0
  for (const r of rows) {
    byKind[r.kind].count += 1
    byKind[r.kind].amount += r.amount
    if (r.kind === 'payout') {
      if (r.status === 'paid') paid += r.amount
      else if (r.status === 'pending') requested += r.amount
    } else {
      earned += r.amount
    }
  }
  return { earned, paid, requested, byKind }
}
