'use strict'
/**
 * ¿Estas peticiones son LENTAS o están chocando contra un TIMEOUT?
 *
 * ## La capa que faltaba (T-315, 30/07/2026)
 *
 * El mismo síntoma —«answer-and-save a 25 segundos»— recibió **tres atribuciones distintas** antes
 * de dar con la causa: estampida de crons del backend (refutada midiendo), render de PDFs (explica
 * otro episodio, no éste) y un cron de 18 minutos que encajaba por horario (refutada: hubo lentas
 * los días que no corrió). Cada una costó horas.
 *
 * **Ninguno de los detectores que ya existían podía distinguirlo**, porque todos miran la MAGNITUD
 * (p95, máximo, % por encima de X) y un timeout y una lentitud real dan la misma magnitud. Lo que
 * los separa es la **FORMA de la cola**:
 *
 *   - **Lentitud orgánica** → la cola ADELGAZA: cada vez menos peticiones conforme sube el tiempo.
 *   - **Timeout** → la cola se AMONTONA justo antes del corte y se acaba EN SECO.
 *
 * Medido en el caso real (14 días, peticiones de más de 5 s): 66 entre 5-10 s, 65 entre 10-20 s,
 * **6 entre 20-24 s**, **19 entre 24-26 s** y **CERO por encima de 26 s**. Ese salto de 6 a 19
 * seguido de la nada es la firma, y se ve en una sola consulta.
 *
 * Aquí vive solo la DECISIÓN, pura y testeable. Quien llama trae los tramos.
 */

/** Un tramo de duraciones y cuántas peticiones cayeron en él. */
// tramos: [{ desdeMs, hastaMs, n }] ordenados de menor a mayor.

/**
 * Mínimo de peticiones en el tramo del techo para afirmar nada. Con 2 o 3 no se distingue una
 * acumulación de una casualidad, y un detector que grita por tres muestras ya nos costó tres
 * falsas alarmas en un solo día (ver `vigia-pico-pdf.ts`).
 */
const MIN_EN_TECHO = 8

/**
 * ¿Hay un techo? Lo hay cuando un tramo tiene MÁS peticiones que el anterior (se amontonan) y
 * después no queda prácticamente nada (se corta en seco).
 *
 * @param {Array<{desdeMs:number, hastaMs:number, n:number}>} tramos ordenados por duración
 * @returns {{hayTecho:boolean, techoMs:number|null, enTecho:number, porEncima:number, motivo:string}}
 */
function detectarTecho(tramos) {
  const t = (tramos ?? []).filter(x => x && Number.isFinite(x.n)).sort((a, b) => a.desdeMs - b.desdeMs)
  if (t.length < 3) {
    return { hayTecho: false, techoMs: null, enTecho: 0, porEncima: 0, motivo: 'tramos_insuficientes' }
  }

  for (let i = 1; i < t.length - 1; i++) {
    const previo = t[i - 1], actual = t[i]
    const porEncima = t.slice(i + 1).reduce((s, x) => s + x.n, 0)
    // La firma: se amontona (más que el tramo anterior), hay volumen suficiente para afirmarlo, y
    // por encima no queda casi nada. El "casi" es a propósito: un timeout puede dejar alguna
    // petición suelta más allá (reintentos, relojes distintos), y exigir CERO lo haría frágil.
    const seAmontona = actual.n > previo.n
    const seCortaEnSeco = porEncima <= Math.max(1, Math.floor(actual.n * 0.1))
    if (seAmontona && actual.n >= MIN_EN_TECHO && seCortaEnSeco) {
      return {
        hayTecho: true, techoMs: actual.hastaMs, enTecho: actual.n, porEncima,
        motivo: `${actual.n} peticiones entre ${actual.desdeMs} y ${actual.hastaMs} ms (el tramo anterior tenía ${previo.n}) y solo ${porEncima} por encima`,
      }
    }
  }
  return { hayTecho: false, techoMs: null, enTecho: 0, porEncima: 0, motivo: 'la cola adelgaza (lentitud real, no techo)' }
}

module.exports = { detectarTecho, MIN_EN_TECHO }
