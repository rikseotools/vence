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

/** A partir de aquí una petición del camino crítico se considera lenta y merece explicación. */
export const UMBRAL_LENTA_MS = 2_000

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
  const val = Math.max(0, Number(f?.validarMs) || 0)
  const gua = Math.max(0, Number(f?.guardarMs) || 0)
  const sco = Math.max(0, Number(f?.scoreMs) || 0)
  const tot = Math.max(0, Number(f?.totalMs) || 0)

  const sumaFases = val + gua + sco
  const noExplicado = Math.max(0, tot - sumaFases)

  const candidatos: Array<[Veredicto['dominante'], number]> = [
    ['validar', val], ['guardar', gua], ['score', sco], ['fuera_de_fases', noExplicado],
  ]
  let dominante: Veredicto['dominante'] = 'fuera_de_fases'
  let mayor = -1
  for (const [nombre, ms] of candidatos) {
    if (ms > mayor) { mayor = ms; dominante = nombre }
  }

  return {
    lenta: tot >= umbralMs,
    dominante,
    noExplicadoMs: noExplicado,
    pctDominante: tot > 0 ? Math.round((mayor / tot) * 100) : 0,
  }
}
