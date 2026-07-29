/**
 * backend/src/shuffle/permute.ts — mapeo de opciones barajadas (posición MOSTRADA ↔ índice ORIGINAL).
 *
 * ⚠️ COPIA de las dos funciones que el frontend tiene en `lib/shuffle/permute.ts`.
 * El backend NestJS es un paquete AISLADO (`backend/tsconfig.json` no tiene paths al
 * frontend y no hay un solo import fuera de `backend/`), así que no puede importarlas.
 * Es la misma convención que ya se usa para `EXAM_POSITION_MAP` y `debeConsumirCupo`:
 * copia + guardarraíl de PARIDAD que falla en CI si divergen
 * (`__tests__/guardrails/shuffleOrderParidad.test.ts`).
 *
 * POR QUÉ EXISTE ESTE FICHERO (incidente del piloto de barajado, T-235):
 * el canary enruta `/api/v2/answer-and-save` al backend (`backend-router.ts`), y aquí
 * NO existía nada de esto: el esquema Zod ni siquiera declaraba `optionOrder` (Zod borra
 * en silencio lo que no declara), y la validación comparaba la posición MOSTRADA contra
 * la clave ORIGINAL. Con el barajado encendido eso marcó como fallo respuestas
 * ACERTADAS: 136 respuestas de 8 usuarios de Valencia, 56 marcadas mal, irreparables
 * porque la permutación no se guardó. El frontend estaba correcto de punta a punta; el
 * eslabón roto era esta segunda implementación del mismo endpoint.
 */

/**
 * Índice ORIGINAL (0=A en BD) que corresponde a la posición MOSTRADA al usuario.
 * Sin `order` (o con uno inválido) → identidad, es decir, el comportamiento histórico.
 */
export function displayedToOriginal(
  order: number[] | null | undefined,
  displayedIdx: number,
): number {
  if (!order) return displayedIdx;
  const mapped = order[displayedIdx];
  return mapped == null ? displayedIdx : mapped;
}

/**
 * ¿Es `order` una permutación válida de [0..n-1]? Ante uno corrupto se trata como null
 * (identidad): nunca se corrige una respuesta con un orden en el que no se puede confiar.
 */
export function isValidOrder(order: unknown, n: number): order is number[] {
  if (!Array.isArray(order) || order.length !== n) return false;
  const seen = new Set<number>();
  for (const v of order) {
    if (!Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}
