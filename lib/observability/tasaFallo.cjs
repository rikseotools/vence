'use strict'
/**
 * ¿Este endpoint falla MUCHO, aunque falle POCAS veces?
 *
 * ## El punto ciego que cierra (30/07/2026)
 *
 * El barrido ya detecta errores 5xx, y los de `/api/v2/difficulty-insights` **sí se registraban**.
 * El problema es otro: los hallazgos se ordenan y recortan por **CANTIDAD**, así que un endpoint con
 * 1-2 fallos al día nunca entra en la lista, por detrás de otros con 6 o 7. Y esos 1-2 al día eran
 * 23 fallos sobre ~503 peticiones en 14 días: **un 4,6%**, con 31 usuarios distintos esperando 12
 * segundos para recibir un 503.
 *
 * **23 fallos sobre 500 peticiones y 23 sobre 20.000 son la misma cifra y problemas distintos.** Sin
 * la tasa, un endpoint roto de bajo tráfico compite por volumen contra uno sano y grande, y pierde
 * siempre.
 *
 * ## La trampa del muestreo (esto es lo que hace falso a un detector de tasas ingenuo)
 *
 * En `observable_events` los dos lados de la división **no se registran con el mismo criterio**:
 *
 *   - los ÉXITOS (`request_completed` 2xx/3xx) van **muestreados al 10%** (`SUCCESS_TIMING_SAMPLE_RATE`),
 *   - los FALLOS (4xx/5xx) van al **100%**.
 *
 * Dividir uno por otro sin corregir infla la tasa **×10**: el caso real daba «32,4%» en crudo frente
 * al **4,6%** verdadero. Un detector así gritaría por endpoints sanos y nadie volvería a hacerle
 * caso. Por eso el denominador se **des-muestrea** aquí dentro y no en quien llama: es la clase de
 * corrección que se olvida en la segunda consulta que alguien escriba.
 *
 * Y por eso el numerador sale **solo de `request_completed`**: los eventos `http_5xx` los emite
 * TAMBIÉN el cliente por su cuenta (`lib/observability/client.ts`), así que sumarlos cuenta dos veces
 * el mismo fallo (medido: 45 eventos `http_5xx` para 23 fallos reales).
 *
 * Aquí vive solo la DECISIÓN, pura y testeable.
 */

/** Fracción de éxitos que llega a registrarse. Espejo de `SUCCESS_TIMING_SAMPLE_RATE`. */
const TASA_MUESTREO_EXITOS = 0.1

/**
 * Eventos de éxito OBSERVADOS mínimos para opinar. Se exige sobre lo observado, no sobre lo
 * estimado: des-muestrear multiplica por diez también la incertidumbre, y con 2 éxitos vistos el
 * «×10» es una invención. Mismo suelo que ya costó tres falsas alarmas calculando percentiles sobre
 * tres muestras (ver `endpoint-latency.ts` y `vigia-pico-pdf.ts`).
 */
const MIN_EXITOS_OBSERVADOS = 20

/** Un 5% de fallos es un endpoint que hay que arreglar; un 1% ya merece mirarse. */
const TASA_ERROR = 0.05
const TASA_AVISO = 0.01

/**
 * @param {{endpoint:string, exitosObservados:number, fallos:number}} e
 *   `exitosObservados` = `request_completed` con 2xx/3xx (muestreados).
 *   `fallos`           = `request_completed` con 5xx (completos).
 */
function clasificarTasa(e, tasaMuestreo = TASA_MUESTREO_EXITOS) {
  const obs = Math.max(0, Number(e?.exitosObservados) || 0)
  const fallos = Math.max(0, Number(e?.fallos) || 0)
  const m = tasaMuestreo > 0 && tasaMuestreo <= 1 ? tasaMuestreo : TASA_MUESTREO_EXITOS

  // El denominador REAL: los éxitos vistos representan solo una fracción; los fallos, todos.
  const exitosEstimados = Math.round(obs / m)
  const totalEstimado = exitosEstimados + fallos
  const tasa = totalEstimado > 0 ? fallos / totalEstimado : 0

  let severidad = 'ok'
  if (obs >= MIN_EXITOS_OBSERVADOS) {
    if (tasa >= TASA_ERROR) severidad = 'error'
    else if (tasa >= TASA_AVISO) severidad = 'warn'
  }
  return {
    endpoint: e?.endpoint,
    exitosObservados: obs,
    totalEstimado,
    fallos,
    tasa: Math.round(tasa * 1000) / 10,
    severidad,
  }
}

/**
 * Los que fallan demasiado, **peor tasa primero**.
 *
 * Ordena por TASA y no por número de fallos a propósito: ordenar por cantidad es exactamente lo que
 * hacía invisible a `difficulty-insights`.
 */
function endpointsQueFallanMucho(lista, tasaMuestreo = TASA_MUESTREO_EXITOS) {
  return (lista ?? [])
    .map(x => clasificarTasa(x, tasaMuestreo))
    .filter(x => x.severidad !== 'ok')
    .sort((a, b) => b.tasa - a.tasa)
}

module.exports = {
  clasificarTasa, endpointsQueFallanMucho,
  TASA_MUESTREO_EXITOS, MIN_EXITOS_OBSERVADOS, TASA_ERROR, TASA_AVISO,
}
