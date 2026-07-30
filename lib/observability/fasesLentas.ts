// lib/observability/fasesLentas.ts
//
// ¿Merece la pena registrar el desglose de esta petición, y qué fase se llevó el tiempo?
//
// ## Por qué existe (T-312, 30/07/2026)
//
// De una petición de **25 segundos que devolvió 200 OK** guardábamos `duration_ms`, host, método y
// `questionId`. **Nada de dónde se fue el tiempo.** La pregunta «¿por qué tardó?» era literalmente
// incontestable, y no era un caso raro: medido sobre 7 días, entre el **0,3% y el 1,3%** de los
// guardados superan los 5 s **todos los días** — sobre ~16.000 peticiones reales, son **50-200
// opositores al día** cuyo guardado se arrastra y de los que no se podía decir nada.
//
// Cuando el 29/07 hubo un incidente de verdad, atribuirlo costó medio día y la primera atribución
// (crons del backend) resultó FALSA. Con un desglose por fases eso son minutos.
//
// ## Por qué solo las lentas, y al 100%
//
// El evento `request_completed` está **muestreado al 10%**, y ese sesgo es justo el que no se puede
// permitir aquí: la petición de 25 s es la que NO puede perderse. Emitir el desglose **solo cuando
// la petición es lenta** da lo mejor de las dos cosas — coste despreciable (son pocas) y cobertura
// TOTAL del caso que importa. Registrar el desglose de una petición de 40 ms no informa de nada.
//
// Aquí vive solo la DECISIÓN, pura y testeable. Quien llama toma los tiempos y emite.

// ## Generalizado el 30/07 (T-319)
//
// Nació para `answer-and-save` con tres fases fijas. Al investigar `difficulty-insights` —4,6% de
// fallos, 14 días invisible— hizo falta EXACTAMENTE lo mismo con otras fases, y la causa hubo que
// reconstruirla a mano contra producción porque el endpoint no guardaba desglose.
//
// La decisión («¿es lenta? ¿qué fase manda? ¿cuánto queda sin explicar?») es la misma sea cual sea
// el endpoint, así que vive UNA sola vez en `evaluarFasesNombradas`. `evaluarFases` se queda como
// estaba —mismo contrato, mismos tests— delegando en ella. Duplicar el núcleo por endpoint habría
// sido crear el silo que garantiza que dentro de tres meses uno de los dos esté mal.

/** A partir de aquí una petición del camino crítico se considera lenta y merece explicación. */
export const UMBRAL_LENTA_MS = 2_000

export interface VeredictoFases<K extends string = string> {
  lenta: boolean
  /** La fase que se llevó MÁS tiempo, o `fuera_de_fases` si el tiempo no está en ninguna medida. */
  dominante: K | 'fuera_de_fases'
  noExplicadoMs: number
  pctDominante: number
}

/**
 * La misma decisión, para cualquier conjunto de fases con nombre.
 *
 * En caso de empate gana la PRIMERA declarada, y `fuera_de_fases` se evalúa la última: así, con
 * todo a cero, no se acusa al entorno de algo que no ha pasado.
 */
export function evaluarFasesNombradas<K extends string>(
  fases: Record<K, number>,
  totalMs: number,
  umbralMs: number = UMBRAL_LENTA_MS,
): VeredictoFases<K> {
  const limpias = Object.entries(fases ?? {}).map(
    ([k, v]) => [k, Math.max(0, Number(v) || 0)] as [K, number],
  )
  const tot = Math.max(0, Number(totalMs) || 0)
  const suma = limpias.reduce((a, [, v]) => a + v, 0)
  const noExplicado = Math.max(0, tot - suma)

  let dominante: K | 'fuera_de_fases' = 'fuera_de_fases'
  let mayor = -1
  for (const [nombre, ms] of [...limpias, ['fuera_de_fases', noExplicado] as [K, number]]) {
    if (ms > mayor) { mayor = ms; dominante = nombre }
  }

  return {
    lenta: tot >= umbralMs,
    dominante,
    noExplicadoMs: noExplicado,
    pctDominante: tot > 0 ? Math.round((mayor / tot) * 100) : 0,
  }
}

export interface Fases {
  /** Validar la respuesta + resolver el tema (van en paralelo). */
  validarMs: number
  /** Escribir en `test_questions`. */
  guardarMs: number
  /** Actualizar el score del test. */
  scoreMs: number
  /** Total de punta a punta, medido por quien llama. */
  totalMs: number
}

export interface Veredicto {
  lenta: boolean
  /** La fase que se llevó MÁS tiempo. Es lo primero que mira quien investiga. */
  dominante: 'validar' | 'guardar' | 'score' | 'fuera_de_fases'
  /** Milisegundos que NO caen en ninguna fase medida (overhead, serialización, GC…). */
  noExplicadoMs: number
  /** % del total que se lleva la fase dominante. */
  pctDominante: number
}

/**
 * Decide si esta petición merece desglose y cuál fue su fase dominante.
 *
 * **`fuera_de_fases` no es un error, es la respuesta más valiosa cuando aparece.** Si el tiempo no
 * está en ninguna fase medida, el problema no es la lógica del handler sino algo de alrededor —
 * event-loop bloqueado, espera de pool, GC, throttle del contenedor. Distinguir «la BD tardó» de
 * «el proceso no llegó a ejecutarme» es exactamente lo que faltaba el 29/07.
 */
export function evaluarFases(f: Fases, umbralMs: number = UMBRAL_LENTA_MS): Veredicto {
  // Contrato intacto: mismas tres fases, mismo orden de desempate. La decisión la toma el núcleo
  // general, que es el que usan también los demás endpoints instrumentados.
  return evaluarFasesNombradas(
    { validar: f?.validarMs, guardar: f?.guardarMs, score: f?.scoreMs } as Record<string, number>,
    f?.totalMs,
    umbralMs,
  ) as Veredicto
}
