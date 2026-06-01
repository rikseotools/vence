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
 * Defensa-en-profundidad — rejection tardía de la promesa perdedora:
 *   `Promise.race` resuelve con el PRIMER settle, pero la promesa que pierde
 *   la carrera SIGUE VIVA. En el caso normal `Promise.race` ya le adjunta un
 *   reactor interno, así que su rejection tardía NO queda unhandled (probado
 *   empíricamente). Aun así, capturamos `work` y le colgamos un `.catch`
 *   no-op explícito por dos motivos: (1) blinda casos límite (thenables no
 *   estándar, fn que lanza síncrono) y (2) hace la intención obvia al lector
 *   — una promesa de `withTimeout` JAMÁS debe poder quedar sin manejar.
 *
 *   El cinturón de seguridad real contra unhandled rejections (las venga de
 *   donde vengan) es el handler global de `process.on('unhandledRejection')`
 *   en `main.ts` (incidente 2026-06-01: un blip de la primaria de BD generó
 *   una unhandled rejection que mató el proceso → crash-loop de 7 min).
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
  // Una sola promesa, reutilizada en la carrera Y en el catch defensivo.
  const work = fn();
  // Si el timeout gana la carrera, `work` queda pendiente y puede rechazar
  // más tarde. Este catch evita que esa rejection tardía sea unhandled.
  // No traga errores reales: si `work` gana la carrera, el `await` de abajo
  // propaga su rejection normalmente al caller (este catch solo absorbe el
  // caso "ya perdí la carrera, a nadie le importa mi resultado").
  work.catch(() => {
    /* rejection tardía tras perder la carrera — manejada, no propaga */
  });
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
