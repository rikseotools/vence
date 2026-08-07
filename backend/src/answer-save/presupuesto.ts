// backend/src/answer-save/presupuesto.ts — el presupuesto de tiempo de
// POST /api/v2/answer-and-save, declarado en UN sitio.
//
// ## Por qué existe ([T-315], decisión de Manuel 05/08 y 07/08/2026)
//
// Hasta hoy este endpoint tenía DOS techos independientes y SECUENCIALES:
// `ANTIFRAUD_TIMEOUT_MS = 10_000` y `VALIDATE_AND_SAVE_TIMEOUT_MS = 15_000`.
// Como el segundo solo arranca cuando el primero termina, el peor caso no era
// el mayor de los dos sino la SUMA: 25 s. Nadie lo había declarado así — salió
// de subir cada número por su lado en momentos distintos (mayo/2026, de 10 s a
// 25 s en dos días, para dejar de ver los 503 sin tocar por qué se tardaba).
//
// La firma de esos dos muros está medida en producción (14 días, tres sesiones
// independientes con cifras casi idénticas):
//
//   | banda `duration_ms` | eventos | % con 503 |
//   |---------------------|---------|-----------|
//   | 10.000-10.999 ms    |      19 |       84% |
//   | 15.000-15.999 ms    |      15 |       80% |
//
// El daño es de usuario, no de métrica: el cliente aborta a los 25 s y la
// pantalla se queda igual que estaba, así que el opositor la ve colgada, sale y
// vuelve a entrar (feedback `e790c7bf`, 07/08: siete cortes seguidos en un solo
// test).
//
// ## El diseño: un presupuesto, no cuatro números
//
// Un solo total —lo que estamos dispuestos a hacer esperar a alguien que acaba
// de contestar una pregunta— del que cada fase consume LO QUE QUEDA. Las fases
// compiten por el mismo presupuesto en vez de tener cada una su cuota fija:
//
//   - Si comprobar tarda lo normal (<500 ms, documentado en el propio código),
//     guardar dispone de casi el presupuesto entero. ANTES se quedaba SIEMPRE
//     con sus 15.000 ms fijos aunque hubiera margen de sobra.
//   - Si comprobar se atasca, no puede comerse el tiempo de guardar: tiene su
//     propio techo corto (`COMPROBACIONES_MAX_MS`) que NO sale del presupuesto
//     de guardar.
//
// Y el peor caso deja de ser una suma abierta —que vuelve a crecer el día que
// alguien suba uno de los dos números sin mirar el otro— para ser el
// presupuesto declarado aquí.
//
// ## Por qué 20 s y no 25 s
//
// El proxy de Vercel (`app/api/v2/answer-and-save/route.ts`) aborta la llamada
// al backend a los 25 s, y el cliente (`lib/api/v2/answer-and-save/client.ts`)
// también. Con el backend presupuestando esos mismos 25 s, quien corta primero
// es SIEMPRE el proxy: el usuario recibe un abort sin causa en vez de nuestro
// 503 con `Retry-After`, y el 503 que el backend iba a devolver no llega nunca.
// Con 20 s el backend termina —bien o mal— DENTRO de la ventana del proxy, así
// que la respuesta que ve el cliente es la nuestra y es interpretable.
//
// No es «bajar el corte» de los que reprodujeron los 503 de mayo: guardar
// conserva sus 15.000 ms en el PEOR caso (20.000 − 5.000) y gana hasta 19.500
// en el normal. Lo único que baja de verdad es el techo de comprobar, 10 s → 5 s,
// que es tiempo que hoy se pierde entero antes de devolver un 503 igualmente.
//
// La relación presupuesto < proxy < `maxDuration` la vigila
// `__tests__/backend/answerSavePresupuestoParidad.test.ts`, que lee los ficheros
// del frontend como texto (el backend no puede importarlos: su imagen Docker
// solo copia `backend/src`).

/** Lo que como mucho puede esperar un opositor tras contestar una pregunta. */
export const ANSWER_SAVE_BUDGET_MS = 20_000;

/**
 * Techo propio del bloque de comprobaciones (dispositivos + cupo del plan free).
 * En el caso normal tarda <500 ms; 5 s es diez veces eso. Lo que pase de ahí ya
 * no es lentitud, es un atasco, y esperarlo solo retrasa el 503.
 */
export const COMPROBACIONES_MAX_MS = 5_000;

/**
 * Suelo de la fase de guardado. Guardar la respuesta es lo ÚNICO que el usuario
 * pierde si no ocurre, así que siempre tiene una oportunidad real aunque el
 * presupuesto venga gastado. Con los valores de arriba nunca llega a aplicarse
 * (guardar hereda ≥15 s); está para que un cambio futuro del presupuesto no
 * pueda dejar la fase que importa sin tiempo.
 */
export const GUARDAR_MIN_MS = 3_000;

export interface Presupuesto {
  /** Milisegundos consumidos desde que se creó. */
  gastadoMs(): number;
  /** Lo que queda del total, nunca negativo. */
  restanteMs(): number;
  /** Milisegundos que se conceden a la fase de comprobaciones. */
  comprobacionesMs(): number;
  /** Milisegundos que se conceden a la fase de guardado. */
  guardarMs(): number;
}

/**
 * Crea un presupuesto que empieza a correr AHORA.
 *
 * @param totalMs presupuesto total (por defecto `ANSWER_SAVE_BUDGET_MS`).
 * @param ahora   reloj inyectable — los tests no dependen del reloj real.
 */
export function crearPresupuesto(
  totalMs: number = ANSWER_SAVE_BUDGET_MS,
  ahora: () => number = Date.now,
): Presupuesto {
  const inicio = ahora();
  const gastadoMs = () => Math.max(0, ahora() - inicio);
  const restanteMs = () => Math.max(0, totalMs - gastadoMs());

  return {
    gastadoMs,
    restanteMs,
    // Nunca más de su techo, y nunca a costa del suelo de guardar: si el
    // presupuesto no da para las dos fases, la que se recorta es ésta.
    comprobacionesMs: () =>
      Math.max(0, Math.min(COMPROBACIONES_MAX_MS, restanteMs() - GUARDAR_MIN_MS)),
    // Lo que sobre, con suelo. Es la fase que guarda la respuesta del usuario.
    guardarMs: () => Math.max(GUARDAR_MIN_MS, restanteMs()),
  };
}
