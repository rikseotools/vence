// backend/src/common/with-timeout.ts
//
// Helper genérico para quick-fail timeouts. Reusable por cualquier endpoint
// que necesite cortar requests largas (anti-fraud, validate-and-save, etc.).
//
// Port del concepto de `lib/db/timeout.ts` del frontend Vercel, simplificado
// (no necesitamos statement_timeout cancelation porque en backend NestJS
// proceso largo el pool tiene capacidad real, no max:1 por lambda).

/** Error tipado lanzado por withTimeout cuando el callback no termina a tiempo. */
export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, label = 'operation') {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** Type guard: ¿es un TimeoutError? */
export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}

/**
 * Ejecuta `fn` con un timeout. Si no termina en `ms` ms, rechaza con
 * TimeoutError. Si termina antes, devuelve el resultado normal.
 *
 * El timer se limpia siempre (tanto si fn resuelve como si rechaza)
 * para no dejar handles colgados que retrasen el shutdown del proceso.
 *
 * @param fn Función async a ejecutar (sin args; usar closure si necesita)
 * @param ms Milisegundos antes de timeout
 * @param label Etiqueta opcional para el mensaje de error
 *
 * @throws TimeoutError si fn no termina en ms ms
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
