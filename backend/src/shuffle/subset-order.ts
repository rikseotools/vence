/**
 * backend/src/shuffle/subset-order.ts — validación del orden de exposición (T-267).
 *
 * ⚠️ COPIA de `isValidExposureOrder` (frontend: `lib/shuffle/subsetOrder.ts`). El backend
 * NestJS es un paquete AISLADO, mismo patrón que `shuffle/permute.ts` y `benign-signals`:
 * copia + guardarraíl de paridad (`__tests__/guardrails/shuffleOrderParidad.test.ts`).
 *
 * POR QUÉ HACE FALTA: desde T-267 una pregunta puede servirse con MENOS opciones de las
 * que tiene (3 de 4, en las oposiciones cuyo examen es de tres). Entonces el `order` deja
 * de ser una permutación completa y `isValidOrder` lo rechazaría → se trataría como
 * identidad → se corregiría la posición MOSTRADA contra la clave ORIGINAL. Es
 * exactamente el fallo que marcó como error 56 aciertos en el piloto de Valencia, y este
 * endpoint es el que lo cometió.
 */

/** Máximo de opciones que puede tener una pregunta en el banco (A-E). */
export const MAX_OPCIONES_BANCO = 5;

/**
 * ¿Es válido el orden que llega al responder?
 *
 * Dos comprobaciones distintas a propósito:
 *   · la LONGITUD, contra las opciones que el usuario VIO;
 *   · los VALORES, contra el techo del banco — apuntan a las opciones ORIGINALES, no a
 *     las mostradas, así que validarlos contra lo mostrado rechazaría todo subconjunto.
 */
export function isValidExposureOrder(
  order: unknown,
  mostradas: number,
  maxOriginales: number = MAX_OPCIONES_BANCO,
): order is number[] {
  if (!Array.isArray(order)) return false;
  if (order.length !== mostradas) return false;
  const vistos = new Set<number>();
  for (const v of order) {
    if (!Number.isInteger(v) || v < 0 || v >= maxOriginales || vistos.has(v)) return false;
    vistos.add(v);
  }
  return true;
}
