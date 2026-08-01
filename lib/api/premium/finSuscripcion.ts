// lib/api/premium/finSuscripcion.ts
//
// Criterio del aviso de «tu suscripción de la cuenta antigua se acaba» y de cuándo caduca el
// precio heredado. (T-448)
//
// ## Por qué existe, y por qué el criterio va aparte del envío
//
// El recordatorio que ya había (`recordatorio_renovacion`) avisa de un COBRO que viene, y por eso
// excluye a propósito a quien tiene `cancel_at_period_end = true`. A esas personas no se les va a
// cobrar: se les va a APAGAR el acceso. Medido el 01/08: **184** suscripciones de la cuenta
// antigua en ese estado, **59** vencen en 30 días, y **170** ya vencieron sin recibir nada. Su
// precio (20/35/59 €) es más barato que el vigente (29/39/69 €), así que el aviso es la
// diferencia entre volver y no volver.
//
// ## La regla del mes, y por qué está aquí y no en el texto del email
//
// Decisión de Manuel (01/08): al terminar pasan a gratis, tienen **un mes** para volver con su
// precio, y pasado ese mes la oferta se anula y contratan a tarifa vigente. El email PROMETE ese
// plazo, así que la promesa y la anulación tienen que salir del MISMO sitio — si el texto dijera
// un mes y el barrido anulara a los 15 días, estaríamos mintiendo sin que nadie lo notara hasta
// que un usuario se quejara. Una función pura, dos consumidores.
//
// Mes NATURAL (mismo día del mes siguiente), no 30 días: es lo que la persona lee en el email
// («hasta el 15 de septiembre») y lo que espera que se le respete.

/** Milisegundos de un día, para las cuentas de días restantes. */
const DIA_MS = 86_400_000

/**
 * Fecha límite para volver con el precio heredado: un mes natural desde que se acaba su
 * suscripción. Si el día no existe en el mes siguiente (31 de enero → febrero), cae al último
 * día de ese mes en vez de saltar al mes siguiente, que es lo que haría un `setMonth` a pelo y
 * daría un plazo de más.
 */
export function fechaLimiteRetorno(finSuscripcion: Date | string): Date {
  const fin = finSuscripcion instanceof Date ? finSuscripcion : new Date(finSuscripcion)
  if (isNaN(fin.getTime())) throw new Error('fechaLimiteRetorno: fecha inválida')
  const limite = new Date(fin.getTime())
  const diaOriginal = limite.getUTCDate()
  limite.setUTCMonth(limite.getUTCMonth() + 1)
  // Si el día se desbordó (31 → 3 de marzo), retroceder al último día del mes correcto.
  if (limite.getUTCDate() !== diaOriginal) limite.setUTCDate(0)
  return limite
}

export interface DatosSuscripcionQueTermina {
  /** ¿Su cobro vive en la cuenta que YA NO admite altas? Solo a esos se les mantiene precio. */
  enCuentaAntigua: boolean
  /** `cancel_at_period_end`: la suscripción no se va a renovar, se va a apagar. */
  seApaga: boolean
  /** Fin del periodo pagado: el día que pierde el acceso. */
  finPeriodo: Date | string | null
}

/**
 * ¿Toca avisar a esta persona hoy?
 *
 * Las tres condiciones son independientes y las tres importan:
 *  - **cuenta antigua**: a quien ya está en la cuenta vigente no hay precio que mantenerle.
 *  - **se apaga**: si va a renovar sola, el aviso correcto es el otro (`recordatorio_renovacion`);
 *    mandar los dos sería contradecirse en el mismo buzón.
 *  - **la fecha cae en la ventana**: el margen (±12 h por defecto) absorbe que el cron corre una
 *    vez al día a hora fija y los periodos vencen a cualquier hora.
 */
export function debeAvisarFinSuscripcion(
  d: DatosSuscripcionQueTermina,
  ahora: Date = new Date(),
  diasAntes = 3,
  margenHoras = 12,
): boolean {
  if (!d.enCuentaAntigua || !d.seApaga || !d.finPeriodo) return false
  const fin = d.finPeriodo instanceof Date ? d.finPeriodo : new Date(d.finPeriodo)
  if (isNaN(fin.getTime())) return false
  const objetivo = ahora.getTime() + diasAntes * DIA_MS
  const margen = margenHoras * 3_600_000
  return Math.abs(fin.getTime() - objetivo) <= margen
}

/**
 * ¿Ya se le pasó el mes de gracia y toca anular su oferta?
 *
 * Se responde con la MISMA `fechaLimiteRetorno` que se le prometió por email. Nunca antes: quien
 * llega el último día tiene que encontrarse su precio.
 */
export function debeAnularOferta(finSuscripcion: Date | string | null, ahora: Date = new Date()): boolean {
  if (!finSuscripcion) return false
  const fin = finSuscripcion instanceof Date ? finSuscripcion : new Date(finSuscripcion)
  if (isNaN(fin.getTime())) return false
  return ahora.getTime() > fechaLimiteRetorno(fin).getTime()
}

/** Días completos que le quedan para volver (0 si ya se le pasó). Para el texto del email. */
export function diasParaVolver(finSuscripcion: Date | string, ahora: Date = new Date()): number {
  const limite = fechaLimiteRetorno(finSuscripcion)
  return Math.max(0, Math.ceil((limite.getTime() - ahora.getTime()) / DIA_MS))
}

/** Fecha en castellano para el email: «15 de septiembre de 2026». */
export function fechaLarga(d: Date | string): string {
  const f = d instanceof Date ? d : new Date(d)
  return f.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' })
}
