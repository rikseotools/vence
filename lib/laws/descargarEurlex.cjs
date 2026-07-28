'use strict'
//
// descargarEurlex — baja el documento oficial de una norma de la UE, con espejo de reserva.
//
// ## Por qué existe (28/07/2026, T-193)
//
// La decisión de QUÉ pedir y de si lo recibido SIRVE es pura y vive en `eurlexConsolidado.js`.
// Aquí está solo lo que toca la red, para que `scripts/actualizar-articulo-oficial.cjs` y
// `scripts/verificar-articulos-vs-boe.cjs` no tengan cada uno su propio bucle: los dos tenían
// copiado el mismo `if (!r.ok) throw` y, por tanto, **el mismo fallo**.
//
// ## El fallo que motivó extraerlo
//
// EUR-Lex está tras CloudFront y, cuando nos raciona, contesta **`202 Accepted` con 0 bytes**.
// `202` cae dentro de `r.ok` (200-299), así que el cuerpo vacío pasaba el filtro, el extractor
// no encontraba ningún artículo y el script concluía «nada que reescribir». Un veredicto falso
// con toda la pinta de ser bueno. Ahora se valida el CONTENIDO y, si EUR-Lex nos limita, se
// reintenta contra Cellar (el repositorio del Publications Office), que sirve el mismo
// documento sin ese filtro.
//
// Si NINGUNA fuente sirve, esto LANZA con el detalle de cada intento. Quedarse sin fuente es un
// error, no un resultado vacío: es justo la distinción que se perdió antes.

const { fuentesDocumento, documentoSirve } = require('./eurlexConsolidado')

const CABECERAS_BASE = { 'User-Agent': 'Mozilla/5.0' }

/**
 * @param {string} id                 id CELEX (`CELEX:02016R0679-20160504`)
 * @param {object} [opts]
 * @param {Function} [opts.fetchImpl] inyectable para poder probarlo sin red
 * @param {Function} [opts.log]       traza por intento
 * @returns {Promise<{html:string, url:string, fuente:string}>}
 */
async function descargarDocumentoOficial(id, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch
  const log = opts.log || (() => {})
  const fallos = []

  for (const f of fuentesDocumento(id)) {
    try {
      const r = await fetchImpl(f.url, { redirect: 'follow', headers: { ...CABECERAS_BASE, ...(f.cabeceras || {}) } })
      const html = r.ok ? await r.text() : ''
      const v = documentoSirve(html)
      if (r.ok && v.sirve) {
        log(`✅ ${f.nombre}: ${html.length} bytes`)
        return { html, url: f.url, fuente: f.nombre }
      }
      const motivo = r.ok ? v.motivo : `HTTP ${r.status}`
      log(`⚠️  ${f.nombre}: ${motivo}`)
      fallos.push(`${f.nombre} (${f.url}) → ${motivo}`)
    } catch (e) {
      log(`⚠️  ${f.nombre}: ${e.message}`)
      fallos.push(`${f.nombre} (${f.url}) → ${e.message}`)
    }
  }

  throw new Error(`no se pudo obtener el texto oficial de ${id}. Intentos:\n  · ${fallos.join('\n  · ')}`)
}

module.exports = { descargarDocumentoOficial }
