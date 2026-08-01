'use strict'
/**
 * Descargar una fuente con NAVEGADOR REAL (la Lambda `vence-backend-headless-fetcher`).
 *
 * ## Por qué existe este módulo (T-453, 01/08/2026)
 *
 * La invocación de la Lambda estaba escrita **dentro de `scripts/seguimiento/sim-headless-aporta.cjs`**,
 * o sea disponible solo para quien SIMULA. Cuando `repuntar-url.cjs` —el escritor de `seguimiento_url`—
 * necesitó medir con navegador, la única salida era copiarla, y una tercera copia del mismo fetch es
 * exactamente cómo nacieron las seis copias del session-id de [T-407] y los cinco escritores de
 * `seguimiento_url` de [T-130]. Se extrae aquí y **los dos la usan**.
 *
 * ## El hueco que esto abre (y que motivó sacarlo)
 *
 * Medido el 01/08: **13 oposiciones ACTIVAS** con `fetcher_type='http'` y el seguimiento en `error`.
 * Varias son SPAs cuyo contenido solo existe tras ejecutar JavaScript. El sistema sabía **degradar**
 * de `headless` a `http` (`ajustar-fetcher-type.cjs`, que consulta `WHERE fetcher_type='headless'`)
 * pero **no promover**: `repuntar-url.cjs` medía siempre por HTTP y rechazaba la URL buena por
 * invigilable. Resultado: una fuente que solo se ve con navegador quedaba invigilable para siempre
 * —y solo 20 de 2.658 oposiciones están en `headless`, no porque no haga falta, sino porque no había
 * camino para llegar—.
 *
 * NO decide nada: la decisión vive en `seguimientoVigilable.cjs` (`clasificarVigilancia`,
 * `veredictoHeadless`), que es puro y tiene su espejo en el backend.
 */

const { execFile } = require('child_process')
const fs = require('fs')

/** Nombre de la función desplegada. Si cambia, cambia en UN sitio. */
const FUNCION = 'vence-backend-headless-fetcher'
const PERFIL = 'vence'
const REGION = 'eu-west-2'

/**
 * @param {string} url
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<{status: number, html: string, error?: string}>}
 *   `status: 0` = no se pudo invocar (sin credenciales, timeout, Lambda caída). Nunca lanza: quien
 *   llama decide, y un fallo de infraestructura NO debe confundirse con «la página está vacía».
 */
function invocarHeadless(url, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({ url, timeout_ms: timeoutMs })).toString('base64')
    const salida = `/tmp/hl-${process.pid}-${Math.abs(hash(url))}.json`
    execFile(
      'aws',
      ['--profile', PERFIL, '--region', REGION, 'lambda', 'invoke',
        '--function-name', FUNCION, '--payload', payload, salida],
      { timeout: timeoutMs + 60000 },
      (err) => {
        if (err) return resolve({ status: 0, html: '', error: String(err.message).slice(0, 120) })
        try {
          resolve(JSON.parse(fs.readFileSync(salida, 'utf8')))
        } catch (e) {
          resolve({ status: 0, html: '', error: e.message.slice(0, 120) })
        } finally {
          try { fs.unlinkSync(salida) } catch { /* noop */ }
        }
      },
    )
  })
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

module.exports = { invocarHeadless, FUNCION }
