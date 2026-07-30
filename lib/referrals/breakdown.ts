// lib/referrals/breakdown.ts
//
// Desglose ADMIN de un embajador: fusiona sus 3 fuentes de recompensa
// (bugs/opiniones, referidos, pagos) en UNA línea de tiempo ordenada, cada
// fila con su ASUNTO, para que el admin lo controle. PURO → testeable.
//
// POR QUÉ (feedback Manuel 13/07): el panel de embajadores mostraba saldos
// pero no dejaba ver, al pinchar, QUÉ compone ese saldo ni el asunto de cada
// recompensa (qué bug, a quién refirió, qué vale). Esta función arma esa vista.

export type BreakdownKind = 'bug' | 'ugc' | 'referral' | 'payout' | 'impugnacion'

export interface BreakdownRow {
  kind: BreakdownKind
  /** € de la recompensa/pago. */
  amount: number
  /** approved | pending | paid | rejected | qualified … (según la fuente). */
  status: string
  /** ISO date. */
  date: string
  /** El "asunto" para tenerlo controlado: extracto del feedback (bug), URL
   *  (opinión), email del referido (referido), método+ref (pago) o el ENUNCIADO
   *  de la pregunta impugnada (impugnación). */
  asunto: string
  /**
   * La pregunta ENTERA, solo en las impugnaciones. Permite desplegarla en el sitio —como en
   * «preguntas guardadas»— en vez de mandar a la persona a otra pantalla: el asunto recortado
   * no basta para reconocer cuál era, que es justo lo que se pedía («que me diga las preguntas
   * que han hecho eso posible»).
   */
  pregunta?: {
    texto: string
    opciones: string[]
    /** Índice 0-3 de la correcta, o null si no consta. */
    correcta: number | null
  }
  /**
   * Id de la impugnación, para abrir su ficha COMPLETA (explicación + artículo vinculado +
   * resolución) en la pantalla de soporte, que ya tiene ese modal construido. No se duplica
   * aquí: mantener dos vistas de lo mismo garantiza que una se quede vieja.
   */
  disputeId?: string
  /**
   * Id de la CONVERSACIÓN del aviso que generó la recompensa (bug/opinión), para abrirla en
   * soporte y releer el hilo entero. Mismo criterio que `disputeId`: se enlaza a la vista que
   * ya existe, no se reconstruye el chat aquí.
   */
  conversationId?: string
}

/**
 * ¿Cómo se le llama a cada fuente CUANDO LO VE LA PERSONA?
 *
 * El desglose nació para el panel de admin (13/07). Al abrirlo al propio embajador
 * (30/07, petición de María José: *«que al pinchar en el saldo me diga las preguntas que han
 * hecho eso posible»*) hacen falta nombres que signifiquen algo fuera de casa: «ugc» o
 * «payout» no los entiende nadie.
 */
/**
 * Enmascara un correo dejando las primeras 5 letras: `marta.perez.llorente@gmail.com` →
 * `marta***************@gmail.com`.
 *
 * El embajador necesita reconocer a quién invitó, no leer su correo entero. El nombre ya se
 * abrevia por lo mismo (`abbreviateReferredName`), pero el desglose de la cartera lo dejaba
 * completo — cinco correos ajenos a la vista de cualquiera que mire la pantalla (Manuel,
 * 30/07/2026). Se aplica en el SERVIDOR: así el correo completo no llega ni al navegador,
 * que es la única forma de que no se pueda leer en las herramientas del navegador.
 */
export function enmascararEmail(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim()
  const arroba = v.lastIndexOf('@')
  if (arroba <= 0) return v // no parece un correo: se devuelve tal cual
  const local = v.slice(0, arroba)
  const dominio = v.slice(arroba)
  const visibles = local.slice(0, 5)
  const ocultas = Math.max(local.length - visibles.length, 0)
  // Si el local es cortísimo (a@b.c) igualmente se oculta algo: nunca devolver el original.
  const relleno = ocultas > 0 ? '*'.repeat(ocultas) : '*'
  return `${visibles}${relleno}${dominio}`
}

export const ETIQUETA_FUENTE: Record<BreakdownKind, string> = {
  bug: 'Fallo reportado',
  ugc: 'Opinión compartida',
  referral: 'Persona invitada',
  payout: 'Tarjeta regalo',
  impugnacion: 'Pregunta impugnada',
}

/**
 * Estado en palabras, y **sin prometer lo que no es**: una recompensa retenida o rechazada
 * NO está en el saldo disponible. Enseñar el desglose sin esta distinción genera la queja
 * contraria («aquí pone 3 € y no los tengo»), que es peor que no enseñarlo.
 */
/**
 * Cómo se llama a un referido que se registró pero todavía no ha pagado.
 *
 * En UNA sola constante porque el mismo estado se pintaba con tres textos distintos según la
 * pantalla —«Registrado · No premium» en la tarjeta y «En revisión» en el desglose—, y el
 * usuario acaba preguntando cuál de los dos es el suyo (Manuel, 30/07/2026). Tres literales
 * sueltos son tres verdades que divergen en cuanto alguien toca una.
 */
export const REFERIDO_SIN_SUSCRIBIR = 'Registrado, aún no se ha suscrito a Premium'

export function etiquetaEstado(status: string, kind?: BreakdownKind): { texto: string; cuenta: boolean } {
  const s = String(status || '').toLowerCase()
  if (s === 'rejected' || s === 'expired') return { texto: 'No aceptada', cuenta: false }
  if (s === 'paid') return { texto: 'Pagada', cuenta: true }
  if (s === 'approved' || s === 'qualified' || s === 'payable') return { texto: 'Aceptada', cuenta: true }
  // `pending` significa cosas distintas según la fuente, y la misma palabra para todas
  // engaña. En un REFERIDO no hay nada que revisar: la persona se registró y todavía no ha
  // comprado, que es de lo que depende la recompensa. Decir «En revisión» ahí sugiere que
  // lo estamos examinando nosotros y que puede caerse por nuestra decisión (Manuel,
  // 30/07/2026: «no sé qué significa que frubenml está en revisión»).
  if (s === 'pending' && kind === 'referral') {
    return { texto: REFERIDO_SIN_SUSCRIBIR, cuenta: false }
  }
  return { texto: 'En revisión', cuenta: false }
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
    impugnacion: { count: 0, amount: 0 },
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
