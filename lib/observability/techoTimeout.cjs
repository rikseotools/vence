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
  const t = (tramos ?? [])
    .filter(x => x && Number.isFinite(x.n) && Number.isFinite(x.desdeMs) && Number.isFinite(x.hastaMs) && x.hastaMs > x.desdeMs)
    .sort((a, b) => a.desdeMs - b.desdeMs)
  if (t.length < 3) {
    return { hayTecho: false, techoMs: null, enTecho: 0, porEncima: 0, motivo: 'tramos_insuficientes' }
  }

  // DENSIDAD, no cuenta bruta. Los tramos no tienen el mismo ancho, así que comparar cuentas es
  // comparar peras con manzanas — y produce falsos positivos justo donde más duele.
  //
  // Medido el 30/07 sobre datos reales, con cuentas brutas salían 4 «techos» y solo 2 eran ciertos:
  //   · answer-and-save  6 en 4 s (1,5/s) → 19 en 2 s (9,5/s)  = la densidad SE MULTIPLICA ×6 → techo
  //   · theme-stats    151 en 5 s (30/s)  → 173 en 10 s (17/s) = la densidad BAJA → cola natural
  //   · pdf              6 en 4 s (1,5/s) → 15 en 34 s (0,4/s) = la densidad BAJA → cola larga y fina
  // Con cuentas, theme-stats y pdf parecían techos (173 > 151, 15 > 0). Con densidad, no lo son.
  const dens = t.map(x => (x.n / ((x.hastaMs - x.desdeMs) / 1000)))

  for (let i = 1; i < t.length - 1; i++) {
    const porEncima = t.slice(i + 1).reduce((s2, x) => s2 + x.n, 0)
    // La firma: la densidad SUBE respecto al tramo anterior (se amontona), hay volumen para
    // afirmarlo, y por encima no queda casi nada (se corta en seco). El «casi» es deliberado: un
    // timeout real deja algún rezagado (reintentos, relojes distintos) y exigir cero sería frágil.
    // Comparar contra el tramo anterior CON DATOS, no contra el inmediatamente anterior: si ese
    // está vacío, cualquier densidad da «×∞» y un hueco en la distribución se lee como un muro.
    // Medido: la ruta del PDF salía como techo por eso, cuando en realidad es una cola larga y fina
    // (0,4 peticiones/s frente a 1,5 antes) que simplemente acaba en su `maxDuration` de 60 s.
    let ref = -1
    for (let k = i - 1; k >= 0; k--) { if (t[k].n > 0) { ref = k; break } }
    const seAmontona = ref >= 0 && dens[i] > dens[ref]
    const seCortaEnSeco = porEncima <= Math.max(1, Math.floor(t[i].n * 0.1))
    if (seAmontona && t[i].n >= MIN_EN_TECHO && seCortaEnSeco) {
      const factor = (dens[i] / dens[ref]).toFixed(1)
      return {
        hayTecho: true, techoMs: t[i].hastaMs, enTecho: t[i].n, porEncima,
        motivo: `${t[i].n} peticiones entre ${t[i].desdeMs} y ${t[i].hastaMs} ms — la densidad se multiplica ×${factor} respecto al tramo anterior y por encima solo quedan ${porEncima}`,
      }
    }
  }
  return { hayTecho: false, techoMs: null, enTecho: 0, porEncima: 0, motivo: 'la densidad no se dispara: es cola natural, no techo' }
}

module.exports = { detectarTecho, MIN_EN_TECHO }
